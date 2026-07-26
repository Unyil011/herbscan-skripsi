import os
import json
import random
import time
import itertools
from fastapi import FastAPI, File, UploadFile, HTTPException, Header, Depends, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from PIL import Image
import io
import jwt
import uuid
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from sqlalchemy.orm import Session
from fastapi.staticfiles import StaticFiles

# Perbaikan path untuk Vercel (karena dieksekusi dari root folder)
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Import Database & Models
from database import engine, get_db
import models

# Inisialisasi Tabel Database
try:
    models.Base.metadata.create_all(bind=engine)
except Exception as e:
    print("WARNING: Gagal inisialisasi tabel database saat boot:", e)

# Konfigurasi JWT
SECRET_KEY = "SPICEGUARD_THESIS_SECRET_KEY"
ALGORITHM = "HS256"
security = HTTPBearer(auto_error=False)

# Google Client ID (Disesuaikan dengan kredensial Google Cloud Anda)
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "287994839540-kf3i2d95ad5ef8m2gkhkeprivqqnt76f.apps.googleusercontent.com")

# Coba memuat dotenv dan google-generativeai
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

try:
    import google.generativeai as genai
    HAS_GENAI = True
except ImportError:
    HAS_GENAI = False

app = FastAPI(
    title="API Deteksi Penyakit Daun Rempah (Gemini Vision AI)",
    description="Backend API berbasis Multimodal Generative AI (Google Gemini Vision) untuk klasifikasi penyakit daun tanaman jahe, kapulaga, dan kencur secara Zero-Shot.",
    version="2.0.0"
)

# Global API Key Pool
API_KEY_POOL = []
api_key_cycle = None

# Cache Memori untuk File Identik (Anti Plin-plan)
predict_cache = {}

# Mengizinkan CORS agar frontend local dapat mengakses API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Deteksi lingkungan Vercel
IS_VERCEL = os.environ.get("VERCEL") == "1"
UPLOAD_DIR = "/tmp" if IS_VERCEL else ("backend/uploads" if os.path.exists("backend/uploads") else "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Sajikan folder uploads ke publik (Frontend)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# System Prompt untuk AI sebagai Pakar Botani & Patologi Tanaman Rempah
SYSTEM_PROMPT = """
Kamu adalah ahli botani dan pakar patologi tanaman rempah profesional tingkat profesor, khususnya untuk tanaman Jahe, Kapulaga, dan Kencur di Indonesia.
Tugasmu adalah menganalisis foto daun tanaman yang diunggah secara SANGAT TELITI dan mendiagnosis spesies tanamannya terlebih dahulu, lalu mendiagnosis kesehatannya (sehat atau sakit).

[ATURAN MUTLAK JENIS TANAMAN]
Jika gambar yang diunggah BUKAN daun tanaman Jahe, Kapulaga, atau Kencur (misal: wajah manusia, hewan, benda, atau daun tanaman lain), kamu WAJIB LANGSUNG MERESPONS SEPERTI INI:
{
    "plant": "Bukan Tanaman Rempah",
    "class_name": "Tidak Dikenali",
    "confidence": 0.99,
    "recommendation": "1. [Analisis Visual] Objek yang diunggah bukan merupakan daun Jahe, Kapulaga, maupun Kencur. 2. [Penyebab] Sistem keamanan AI kami mendeteksi bahwa ini adalah objek lain. 3. [Langkah Penanganan] Harap unggah foto daun tanaman rempah yang sesuai dengan kriteria sistem kami agar dapat dianalisis."
}
Jangan teruskan analisis jika bukan 3 tanaman tersebut!

[PANDUAN MORFOLOGI IDENTIFIKASI SPESIES - WAJIB DIBACA]
1. KENCUR (SANGAT PENTING): Daun kencur berbentuk BULAT TELUR atau ELIPS MELEBAR. Daunnya TUMBUH MENDATAR MERAYAP DI PERMUKAAN TANAH (tidak punya batang tinggi). Daunnya tebal dan halus. Jika kamu melihat daun lebar yang menempel di tanah, itu PASTI KENCUR!
2. KAPULAGA: Daun memanjang (lanset) tapi ukurannya sangat LEBAR dan PANJANG. Tumbuh pada batang semu yang TINGGI TEGAK, beralur-alur tegas.
3. JAHE: Daun berbentuk lanset (memanjang) sempit seperti pita. Ukurannya kecil/pendek, berwarna hijau terang, urat daun halus. Tumbuh pada batang semu tegak.

[PANDUAN DIAGNOSIS PENYAKIT & REKOMENDASI]
Jika itu benar tanaman Jahe/Kapulaga/Kencur, berikan diagnosis yang SANGAT CERDAS dan KOMPLEKS.
- Sebutkan NAMA PATOGEN (jamur/bakteri) atau NAMA HAMA jika sakit.
- Untuk penanganan organik, JANGAN HANYA BILANG "pupuk organik", sebutkan BAHAN-BAHAN SPESIFIK (contoh: semprotan ekstrak bawang putih, sabun cuci piring, air rebusan daun mimba, atau abu gosok).
- Untuk penanganan kimiawi, sebutkan NAMA ZAT AKTIF yang tepat (contoh: fungisida berbahan aktif Mankozeb/Propineb, insektisida berbahan aktif Abamektin).
- Jika daun tampak hijau merata dan subur tanpa bercak/kuning/bolong, diagnosis sebagai "Sehat" dengan confidence 0.99.

PENTING: Kamu WAJIB merespons HANYA dalam format JSON string yang valid tanpa markdown code block, dengan struktur tepat seperti berikut:
{
    "plant": "<Nama Tanaman: 'Jahe', 'Kapulaga', atau 'Kencur'>",
    "class_name": "<Diagnosis Penyakit Umum: Misal 'Bercak Daun Jamur', atau 'Sehat' jika daun segar mulus>",
    "confidence": <Angka float desimal 0.88 sampai 0.99 yang menunjukkan tingkat keyakinan diagnosis>,
    "recommendation": "<PENTING: WAJIB DIBAGI MENJADI 3 POIN BERNOMOR PERSIS SEPERTI INI: '1. Tulis analisis visual mendalam di sini tanpa prefix apapun. 2. Tulis penyebab penyakit di sini tanpa prefix apapun. 3. Tulis langkah penanganan di sini tanpa prefix apapun.' JANGAN pernah menuliskan kata '[Analisis Visual]' atau '[Penyebab]' di dalam teks jawabanmu.>"
}
"""

# Kamus rekomendasi fallback untuk Mode Simulasi (jika API Key belum dimasukkan)
SIMULATION_RESPONSES = [
    {
        "plant": "Jahe",
        "class_name": "Bercak Daun",
        "confidence": 0.9642,
        "recommendation": "[MODE SIMULASI - MASUKKAN API KEY GEMINI UNTUK HASIL REAL AI] Terdeteksi gejala Bercak Daun pada daun Jahe. Pada foto terlihat bercak kuning kecokelatan yang membesar. Rekomendasi: 1) Pangkas daun terinfeksi, 2) Semprotkan fungisida nabati (ekstrak mimba) atau mankozeb seminggu sekali, 3) Jaga drainase tanah agar tidak lembap berlebih."
    },
    {
        "plant": "Kapulaga",
        "class_name": "Antraknosa",
        "confidence": 0.9415,
        "recommendation": "[MODE SIMULASI - MASUKKAN API KEY GEMINI UNTUK HASIL REAL AI] Terdeteksi Antraknosa pada daun Kapulaga. Terlihat bercak cokelat gelap dengan tepi yang mengalami klorosis (menguning). Rekomendasi: Kurangi kelebatan rumpun tanaman untuk sirkulasi udara, gunakan agens hayati Trichoderma pada tanah, atau aplikasikan fungisida sistemik karbendazim."
    },
    {
        "plant": "Kencur",
        "class_name": "Sehat",
        "confidence": 0.9850,
        "recommendation": "[MODE SIMULASI - MASUKKAN API KEY GEMINI UNTUK HASIL REAL AI] Daun Kencur dalam kondisi sehat! Warna hijau cerah merata tanpa ada tanda serangan jamur atau bakteri. Lanjutkan penyiraman rutin 1-2 kali sehari dan berikan pupuk kompos secara teratur."
    }
]

@app.on_event("startup")
def startup_event():
    global API_KEY_POOL, api_key_cycle
    print("="*70)
    print(" MENJALANKAN BACKEND API DETEKSI PENYAKIT DAUN (GEMINI VISION AI) ")
    print("="*70)
    if not HAS_GENAI:
        print("[PERINGATAN] Pustaka 'google-generativeai' belum terpasang.")
        print("[INFO] Install dengan: pip install google-generativeai")
    
    api_key_env = os.getenv("GEMINI_API_KEYS", os.getenv("GEMINI_API_KEY", ""))
    API_KEY_POOL = [k.strip() for k in api_key_env.split(",") if k.strip()]
    
    if API_KEY_POOL:
        api_key_cycle = itertools.cycle(API_KEY_POOL)
        print(f"[SUKSES] Terdeteksi {len(API_KEY_POOL)} API Key Gemini di environment variables / .env!")
        print("[STATUS] Backend siap menerima analisis Real-Time dengan sistem API Key Pooling.")
    else:
        print("[INFO] GEMINI_API_KEYS belum diatur di server.")
        print("[STATUS] Server TIDAK BISA mendiagnosis tanpa API Key. Silakan tambahkan GEMINI_API_KEYS di .env!")
    print("="*70)

@app.get("/")
def read_root():
    return {
        "status": "Online",
        "message": "API Deteksi Penyakit Daun Rempah (Gemini Vision AI) siap digunakan.",
        "engine": "Google Gemini Vision (Zero-Shot Multimodal)",
        "server_has_api_key": len(API_KEY_POOL) > 0,
        "total_keys_in_pool": len(API_KEY_POOL)
    }

def get_best_vision_model():
    candidates = [
        "gemini-2.5-flash",
        "models/gemini-2.5-flash",
        "gemini-2.0-flash",
        "models/gemini-2.0-flash",
        "gemini-2.5-pro",
        "models/gemini-2.5-pro"
    ]
    try:
        available = [m.name for m in genai.list_models() if 'generateContent' in m.supported_generation_methods]
        for cand in candidates:
            if cand in available or f"models/{cand}" in available:
                chosen = cand if cand in available else f"models/{cand}"
                print(f"[SUKSES] Memilih model Gemini: {chosen}")
                return chosen
        if available: return available[0]
    except Exception as e:
        print(f"[WARNING] Gagal mengecek list_models ({e})")
        
    return "gemini-2.5-flash"

# Helper untuk memverifikasi token JWT dari frontend
def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)):
    if not credentials:
        return None
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_email = payload.get("sub")
        if user_email is None:
            return None
        user = db.query(models.User).filter(models.User.email == user_email).first()
        return user
    except jwt.PyJWTError:
        return None

def get_admin_user(current_user: models.User = Depends(get_current_user)):
    if not current_user or current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Akses ditolak. Anda bukan admin.")
    return current_user

@app.post("/auth/google")
async def auth_google(request_data: dict, db: Session = Depends(get_db)):
    token = request_data.get("credential")
    if not token:
        raise HTTPException(status_code=400, detail="Token tidak ditemukan")

    try:
        # Verifikasi token Google dengan Client ID asli
        idinfo = id_token.verify_oauth2_token(
            token, google_requests.Request(), 
            audience=GOOGLE_CLIENT_ID
        )
        
        email = idinfo.get("email")
        google_id = idinfo.get("sub")
        
        # Ambil username dari email (misal: rivalram@gmail.com -> rivalram)
        username = email.split('@')[0]

        # Cek apakah user sudah ada di database
        user = db.query(models.User).filter(models.User.email == email).first()
        if not user:
            # Buat user baru
            user = models.User(
                google_id=google_id,
                email=email,
                name=username,  # Menyimpan hanya nama email
                picture=idinfo.get("picture")
            )
            db.add(user)
            db.commit()
            db.refresh(user)

        # Buat JWT untuk sesi internal kita
        jwt_token = jwt.encode({"sub": user.email}, SECRET_KEY, algorithm=ALGORITHM)
        
        return {
            "status": "success",
            "token": jwt_token,
            "user": {
                "name": user.name,
                "email": user.email,
                "picture": user.picture
            }
        }
    except ValueError:
        raise HTTPException(status_code=401, detail="Token Google tidak valid")

@app.get("/history")
async def get_history(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Anda belum login")
    
    histories = db.query(models.History).filter(models.History.user_id == current_user.id).order_by(models.History.created_at.desc()).all()
    
    return {
        "status": "success",
        "data": histories
    }

@app.delete("/history/{history_id}")
async def delete_history(history_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Anda belum login")
    
    history = db.query(models.History).filter(models.History.id == history_id, models.History.user_id == current_user.id).first()
    if not history:
        raise HTTPException(status_code=404, detail="Riwayat tidak ditemukan")
        
    db.delete(history)
    db.commit()
    
    return {"status": "success", "message": "Riwayat berhasil dihapus"}

from pydantic import BaseModel
from typing import List

class DeleteBulkRequest(BaseModel):
    history_ids: List[int]

@app.post("/history/bulk-delete")
async def delete_history_bulk(req: DeleteBulkRequest, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Anda belum login")
        
    db.query(models.History).filter(
        models.History.id.in_(req.history_ids), 
        models.History.user_id == current_user.id
    ).delete(synchronize_session=False)
    db.commit()
    
    return {"status": "success", "message": "Riwayat yang dipilih berhasil dihapus"}

@app.post("/predict")
async def predict(
    file: UploadFile = File(...),
    location: str = Form("Tidak Diketahui"),
    lat: float = Form(None),
    lng: float = Form(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # 1. Validasi Ekstensi File
    allowed_extensions = ["jpg", "jpeg", "png", "webp"]
    file_ext = file.filename.split(".")[-1].lower()
    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400, 
            detail=f"Format file tidak didukung. Hanya menerima file dengan format: {', '.join(allowed_extensions)}"
        )
        
    try:
        # Baca file biner gambar
        contents = await file.read()
        
        # [FITUR ANTI-PLIN-PLAN] Buat sidik jari unik (Hash) dari foto ini
        import hashlib
        image_hash = hashlib.md5(contents).hexdigest()
        
        # Jika foto yang persis sama (sampai ke level piksel) pernah diupload sebelumnya
        # Langsung berikan jawaban dari ingatan server, jangan tanya AI lagi!
        if image_hash in predict_cache:
            # Tetap catat riwayat jika user login
            if current_user:
                cached_data = predict_cache[image_hash]
                new_history = models.History(
                    user_id=current_user.id,
                    plant_name=cached_data["plant"],
                    disease_class=cached_data["class_name"],
                    confidence=cached_data["confidence"],
                    recommendation=cached_data["recommendation"],
                    image_filename=cached_data.get("image_filename"),
                    location=location,
                    lat=lat,
                    lng=lng
                )
                db.add(new_history)
                db.commit()
            return predict_cache[image_hash]

        image = Image.open(io.BytesIO(contents)).convert("RGB")
        
        # Simpan gambar fisik ke folder uploads
        image_filename = f"{uuid.uuid4().hex}.jpg"
        upload_path = os.path.join(UPLOAD_DIR, image_filename)
        image.save(upload_path, format="JPEG", quality=85)
        
    except Exception as e:
        print("Error processing image:", e)
        raise HTTPException(
            status_code=400,
            detail="Mohon maaf, layanan deteksi AI saat ini sedang sibuk atau kehabisan kuota harian. Silakan coba lagi nanti."
    )

from sqlalchemy import extract, func

@app.get("/admin/stats")
async def get_admin_stats(
    month: int = None,
    year: int = None,
    admin_user: models.User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    query = db.query(models.History)
    if month:
        query = query.filter(extract('month', models.History.created_at) == month)
    if year:
        query = query.filter(extract('year', models.History.created_at) == year)
        
    total_scans = query.count()
    
    # Total Users registered
    total_users = db.query(models.User).count()
    
    # Penyakit terbanyak
    disease_counts = db.query(
        models.History.disease_class, 
        func.count(models.History.id).label('count')
    )
    if month: disease_counts = disease_counts.filter(extract('month', models.History.created_at) == month)
    if year: disease_counts = disease_counts.filter(extract('year', models.History.created_at) == year)
    disease_counts = disease_counts.group_by(models.History.disease_class).order_by(func.count(models.History.id).desc()).all()
    
    # Tanaman terbanyak
    plant_counts = db.query(
        models.History.plant_name, 
        func.count(models.History.id).label('count')
    )
    if month: plant_counts = plant_counts.filter(extract('month', models.History.created_at) == month)
    if year: plant_counts = plant_counts.filter(extract('year', models.History.created_at) == year)
    plant_counts = plant_counts.group_by(models.History.plant_name).order_by(func.count(models.History.id).desc()).all()
    
    # Lokasi rawan (Kecamatan)
    location_counts = db.query(
        models.History.location, 
        func.count(models.History.id).label('count')
    )
    if month: location_counts = location_counts.filter(extract('month', models.History.created_at) == month)
    if year: location_counts = location_counts.filter(extract('year', models.History.created_at) == year)
    location_counts = location_counts.group_by(models.History.location).order_by(func.count(models.History.id).desc()).all()

    # Tren per bulan (Jika filter tahun aktif)
    monthly_trends = []
    if year:
        trend_query = db.query(
            extract('month', models.History.created_at).label('month'),
            func.count(models.History.id).label('count')
        ).filter(extract('year', models.History.created_at) == year).group_by('month').order_by('month').all()
        monthly_trends = [{"month": int(row.month), "count": row.count} for row in trend_query]

    # Data Map Points (Lat/Lng)
    map_points = query.filter(models.History.lat.isnot(None), models.History.lng.isnot(None)).with_entities(
        models.History.lat, models.History.lng, models.History.disease_class
    ).all()

    return {
        "status": "success",
        "data": {
            "total_users": total_users,
            "total_scans": total_scans,
            "diseases": [{"name": r[0], "count": r[1]} for r in disease_counts],
            "plants": [{"name": r[0], "count": r[1]} for r in plant_counts],
            "locations": [{"name": r[0], "count": r[1]} for r in location_counts],
            "monthly_trends": monthly_trends,
            "map_points": [{"lat": r[0], "lng": r[1], "disease": r[2]} for r in map_points]
        }
    }

@app.get("/admin/history")
async def get_admin_history(
    month: int = None,
    year: int = None,
    admin_user: models.User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    query = db.query(
        models.History.id,
        models.History.created_at,
        models.User.name.label('user_name'),
        models.History.location,
        models.History.plant_name,
        models.History.disease_class,
        models.History.confidence
    ).join(models.User, models.History.user_id == models.User.id)
    
    if month:
        query = query.filter(extract('month', models.History.created_at) == month)
    if year:
        query = query.filter(extract('year', models.History.created_at) == year)
        
    histories = query.order_by(models.History.created_at.desc()).all()
    
    result = []
    for h in histories:
        result.append({
            "id": h.id,
            "date": h.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            "user": h.user_name,
            "location": h.location,
            "plant": h.plant_name,
            "disease": h.disease_class,
            "confidence": f"{h.confidence:.1f}%" if h.confidence else "N/A"
        })
        
    return {
        "status": "success",
        "data": result
    }

    # 3. Proses Analisis dengan Gemini Vision AI
    if not HAS_GENAI or len(API_KEY_POOL) == 0:
        # MODE SIMULASI JIKA TIDAK ADA API KEY
        mock_data = random.choice(SIMULATION_RESPONSES)
        result_data = {
            "status": "success",
            "plant": mock_data["plant"],
            "class_name": mock_data["class_name"],
            "confidence": mock_data["confidence"],
            "recommendation": mock_data["recommendation"],
            "image_filename": image_filename,
            "is_mock": True
        }
        
        # Simpan ke Database Riwayat
        if current_user:
            new_history = models.History(
                user_id=current_user.id,
                plant_name=result_data["plant"],
                disease_class=result_data["class_name"],
                confidence=result_data["confidence"],
                recommendation=result_data["recommendation"],
                image_filename=result_data["image_filename"],
                location=location,
                lat=lat,
                lng=lng
            )
            db.add(new_history)
            db.commit()
            
        return result_data

    # ATUR TEMPERATURE KE 0.0 AGAR HASILNYA 100% KONSISTEN
    generation_config = genai.types.GenerationConfig(
        temperature=0.0,
        top_p=1.0,
        top_k=32
    )

    # [FITUR AUTO-RETRY POOLING]
    last_error_msg = ""
    for attempt in range(len(API_KEY_POOL)):
        active_api_key = next(api_key_cycle)
        try:
            genai.configure(api_key=active_api_key)
            chosen_model_name = get_best_vision_model()
            model = genai.GenerativeModel(chosen_model_name)
            
            response = model.generate_content([SYSTEM_PROMPT, image], generation_config=generation_config)
            
            # Parsing respons teks menjadi JSON
            res_text = response.text.strip()
            if res_text.startswith("```json"):
                res_text = res_text[7:]
            elif res_text.startswith("```"):
                res_text = res_text[3:]
            if res_text.endswith("```"):
                res_text = res_text[:-3]
            res_text = res_text.strip()
            
            try:
                ai_data = json.loads(res_text)
            except json.JSONDecodeError:
                # Jika respons AI bukan JSON, tangani dengan anggun
                ai_data = {
                    "plant": "Tanaman Rempah",
                    "class_name": "Diagnosis Selesai",
                    "confidence": 0.92,
                    "recommendation": response.text
                }
            
            result_data = {
                "status": "success",
                "plant": ai_data.get("plant", "Tanaman Rempah"),
                "class_name": ai_data.get("class_name", "Hasil Diagnosis"),
                "confidence": float(ai_data.get("confidence", 0.95)),
                "recommendation": ai_data.get("recommendation", "Tidak ada detail rekomendasi."),
                "image_filename": image_filename,
                "is_mock": False
            }

            # Simpan ke Database Riwayat & Ingatan Piksel
            if current_user:
                new_history = models.History(
                    user_id=current_user.id,
                    plant_name=result_data["plant"],
                    disease_class=result_data["class_name"],
                    confidence=result_data["confidence"],
                    recommendation=result_data["recommendation"],
                    image_filename=result_data["image_filename"],
                    location=location,
                    lat=lat,
                    lng=lng
                )
                db.add(new_history)
                db.commit()

            predict_cache[image_hash] = result_data
            return result_data

        except Exception as e:
            err_msg = str(e).lower()
            last_error_msg = str(e)
            print(f"[WARNING] API Key ke-{attempt+1} gagal memproses gambar. Mencoba kunci berikutnya secara diam-diam. Error: {last_error_msg}")
            # Lanjutkan ke kunci API berikutnya tanpa mempedulikan jenis errornya (Quota limit, Model 404, Network error, dll).
            continue
            
    # Jika loop selesai tapi tidak ada yang return, berarti SEMUA key di pool gagal/habis kuota
    raise HTTPException(
        status_code=429,
        detail="Sistem sedang mengalami kepadatan akses. Seluruh API Key di server telah mencapai batas. Mohon tunggu beberapa saat atau tambahkan API Key baru."
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
