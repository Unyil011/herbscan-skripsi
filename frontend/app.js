// Konstanta Backend URL (Kosong = gunakan domain yang sama)
const BACKEND_URL = "https://herbscan-skripsi.vercel.app";

// --- REFERENSI DOM UTAMA ---
const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("file-input");
const imagePreview = document.getElementById("image-preview");
const previewContainer = document.getElementById("preview-container");
const removeImgBtn = document.getElementById("remove-img-btn");
const dropzonePrompt = document.getElementById("dropzone-prompt");
const detectBtn = document.getElementById("detect-btn");

// DOM Hasil Diagnosis
const resultPlaceholder = document.getElementById("result-placeholder");
const resultLoading = document.getElementById("result-loading");
const resultContent = document.getElementById("result-content");

const resPlant = document.getElementById("result-plant");
const resStatus = document.getElementById("result-status");
const resConfidence = document.getElementById("result-confidence");
const resRecommendation = document.getElementById("result-recommendation");
const progressRingBar = document.getElementById("progress-ring-bar");
const btnDownloadPdf = document.getElementById("btn-download-pdf");

// Parser Markdown sederhana untuk teks Rekomendasi Gemini
window.parseRecommendationText = function(text) {
    if (!text) return "";
    
    // Fallback khusus (Tidak terdeteksi)
    if (text.includes("Bukan Tanaman Rempah") || text.includes("Tidak Dikenali") || text.includes("bukan merupakan daun")) {
        return `<div class="bg-red-500/10 border border-red-500/20 p-4 rounded-xl text-red-500 dark:text-red-400 font-medium">${text.replace(/\n/g, '<br>')}</div>`;
    }

    // Pisahkan berdasarkan angka (1., 2., 3.)
    const parts = text.split(/(?=\d+\.\s)/).map(s => s.trim()).filter(s => s.length > 0);
    
    if (parts.length >= 3) {
        const titles = [
            "<i class='fa-solid fa-magnifying-glass text-emerald-500 dark:text-emerald-400 mr-2'></i> Analisis Visual", 
            "<i class='fa-solid fa-microbe text-emerald-500 dark:text-emerald-400 mr-2'></i> Penyebab", 
            "<i class='fa-solid fa-leaf text-emerald-500 dark:text-emerald-400 mr-2'></i> Langkah Penanganan"
        ];
                        
        let html = '<div class="grid grid-cols-1 gap-4 mt-2">';
        
        parts.forEach((part, index) => {
            // Hapus prefix "1. ", "2. ", "3. "
            let content = part.replace(/^\d+\.\s*/, '');
            // Format Bold
            content = content.replace(/\*\*(.*?)\*\*/g, '<strong class="text-emerald-600 dark:text-emerald-400">$1</strong>');
            content = content.replace(/\*(.*?)\*/g, '<em>$1</em>');
            
            const title = titles[index] || `<i class="fa-solid fa-circle-info text-emerald-500 dark:text-emerald-400 mr-2"></i> Poin ${index+1}`;
            
            html += `
            <div class="bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700/50 p-4 rounded-xl shadow-sm">
                <h4 class="text-gray-900 dark:text-gray-200 font-bold mb-2 flex items-center">${title}</h4>
                <p class="text-gray-700 dark:text-gray-400 text-sm leading-relaxed">${content}</p>
            </div>
            `;
        });
        
        html += '</div>';
        return html;
    }

    // Jika formatnya tidak beraturan, gunakan fallback biasa
    let html = text.replace(/\*\*(.*?)\*\*/g, '<strong class="text-emerald-600 dark:text-emerald-400">$1</strong>');
    return `<div class="text-gray-700 dark:text-gray-400 text-sm leading-relaxed">${html.replace(/\n/g, '<br>')}</div>`;
};

// DOM Baru (Aksi & Modal)
const newActionsContainer = document.getElementById("new-actions-container");
const btnNewPhoto = document.getElementById("btn-new-photo");
const btnOpenCamera = document.getElementById("btn-open-camera");

const cameraModal = document.getElementById("camera-modal");
const btnCloseCamera = document.getElementById("btn-close-camera");
const cameraStream = document.getElementById("camera-stream");
const cameraLoading = document.getElementById("camera-loading");
const btnCapturePhoto = document.getElementById("btn-capture-photo");
const cameraCanvas = document.getElementById("camera-canvas");

const loginModal = document.getElementById("login-modal");
const guestLoginModal = document.getElementById("guest-login-modal");
const googleLoginModalBtn = document.getElementById("google-login-modal-btn");
const googleGuestLoginModalBtn = document.getElementById("google-guest-login-modal-btn");
const btnContinueGuest = document.getElementById("btn-continue-guest");

// DOM Autentikasi & Profil
const authContainer = document.getElementById("auth-container");
const googleLoginBtnArea = document.getElementById("google-login-btn");
const userProfile = document.getElementById("user-profile");
const profilePic = document.getElementById("profile-pic");
const profileName = document.getElementById("profile-name");
const profileDropdown = document.getElementById("profile-dropdown");
const btnLogout = document.getElementById("btn-logout");
const loginPromptArea = document.getElementById("login-prompt-area");
const googleLoginBtnPrompt = document.getElementById("google-login-btn-prompt");

// DOM Navbar Mobile
const mobileMenuBtn = document.getElementById("mobile-menu-btn");
const mobileMenu = document.getElementById("mobile-menu");
const navHistory = document.getElementById("nav-history");
const mobileNavHistory = document.getElementById("mobile-nav-history");

// DOM History Page
const historyListContainer = document.getElementById("history-list-container");

// Toast Notification
const toast = document.getElementById("toast");
const toastMessage = document.getElementById("toast-message");

// State Global
let currentFile = null;
let authToken = localStorage.getItem("herbscan_token") || null;
let userData = JSON.parse(localStorage.getItem("herbscan_user")) || null;
let pendingAction = null; // Menyimpan aksi (upload/camera) jika tertahan modal login
let pendingDroppedFile = null; // Menyimpan file hasil drag & drop
let isCameraActive = false;
let mediaStream = null; // Untuk stream kamera
let lastLocationData = null; // Menyimpan lokasi terakhir untuk retroactive save

// ============================================================================
// 1. AUTENTIKASI (GOOGLE IDENTITY SERVICES)
// ============================================================================

function renderGoogleButtons() {
    if (typeof google === 'undefined') {
        setTimeout(renderGoogleButtons, 500);
        return;
    }
    
    // Inisialisasi Google Auth
    google.accounts.id.initialize({
        client_id: "287994839540-kf3i2d95ad5ef8m2gkhkeprivqqnt76f.apps.googleusercontent.com",
        callback: handleCredentialResponse
    });

    // Render tombol di header (jika ada)
    if (googleLoginModalBtn) {
        google.accounts.id.renderButton(
            googleLoginModalBtn,
            { theme: "outline", size: "large", width: 280, shape: "pill" }
        );
    }
    if (googleGuestLoginModalBtn) {
        google.accounts.id.renderButton(
            googleGuestLoginModalBtn,
            { theme: "outline", size: "large", width: 280, shape: "pill" }
        );
    }
    
    // Render tombol bujukan di hasil (jika ada)
    if (googleLoginBtnPrompt) {
        google.accounts.id.renderButton(
            googleLoginBtnPrompt,
            { theme: "filled_blue", size: "large", text: "continue_with", shape: "pill" }
        );
    }

    // Render tombol di Modal Peringatan (jika ada)
    if (googleLoginModalBtn) {
        google.accounts.id.renderButton(
            googleLoginModalBtn,
            { theme: "filled_blue", size: "large", text: "continue_with", width: 250 }
        );
    }
}

// Handler saat Google berhasil login
async function handleCredentialResponse(response) {
    const googleToken = response.credential;
    
    // Sembunyikan modal jika ada
    if (typeof closeLoginModal === "function") {
        closeLoginModal();
    }
    
    try {
        const res = await fetch(`${BACKEND_URL}/auth/google`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ credential: googleToken })
        });
        
        const data = await res.json();
        if (res.ok && data.status === "success") {
            // Simpan sesi
            authToken = data.token;
            userData = data.user;
            localStorage.setItem("herbscan_token", authToken);
            localStorage.setItem("herbscan_user", JSON.stringify(userData));
            
            showToast("Berhasil masuk. Riwayat Anda sekarang aktif!");
            updateAuthUI();
            loginModal.classList.add("hidden");
            if (guestLoginModal) guestLoginModal.classList.add("hidden");

            // Jika login dilakukan dari layar Hasil Deteksi (tombol simpan permanen)
            const loginPromptArea = document.getElementById("login-prompt-area");
            if (loginPromptArea && !loginPromptArea.classList.contains("hidden")) {
                loginPromptArea.classList.add("hidden");
                if (currentFile) {
                    // Kirim ulang deteksi di latar belakang dengan overlay pemblokir
                    silentRetroactiveSave();
                }
            }
            
            // Lanjutkan aksi yang tertahan (jika ada)
            if (pendingAction === "upload") {
                fileInput.click();
            } else if (pendingAction === "camera") {
                openCamera();
            } else if (pendingAction === "drop" && pendingDroppedFile) {
                handleFileSelect(pendingDroppedFile[0]);
                fileInput.files = pendingDroppedFile;
                pendingDroppedFile = null;
            }
            pendingAction = null;
            
        } else {
            showToast("Gagal memverifikasi login Google.", true);
        }
    } catch (err) {
        console.error(err);
        showToast("Server tidak merespons saat login.", true);
    }
}

// Perbarui UI Header berdasarkan status login
function updateAuthUI() {
    if (authToken && userData) {
        if(googleLoginBtnArea) googleLoginBtnArea.classList.add("hidden");
        const customLoginBtn = document.getElementById("custom-login-btn");
        if(customLoginBtn) { customLoginBtn.classList.add("hidden"); customLoginBtn.style.display = "none"; }
        const customLoginBtnMobile = document.getElementById("custom-login-btn-mobile");
        if(customLoginBtnMobile) { customLoginBtnMobile.classList.add("hidden"); customLoginBtnMobile.style.display = "none"; }
        
        if(userProfile) userProfile.classList.remove("hidden");
        
        profilePic.src = userData.picture;
        profileName.textContent = userData.name;
        
        // Update nama di mobile menu jika ada
        const mobileProfileName = document.getElementById("mobile-profile-name");
        if(mobileProfileName) mobileProfileName.textContent = userData.name;
        
        if(navHistory) navHistory.classList.remove("hidden");
        if(mobileNavHistory) mobileNavHistory.classList.remove("hidden");
        
        const mobileProfileInfo = document.getElementById("mobile-profile-info");
        if(mobileProfileInfo) mobileProfileInfo.classList.remove("hidden");
        
        if(loginPromptArea) loginPromptArea.classList.add("hidden");
        if(btnDownloadPdf) btnDownloadPdf.classList.remove("hidden");
    } else {
        if(googleLoginBtnArea) googleLoginBtnArea.classList.remove("hidden");
        const customLoginBtn = document.getElementById("custom-login-btn");
        if(customLoginBtn) { customLoginBtn.classList.remove("hidden"); customLoginBtn.style.display = ""; }
        const customLoginBtnMobile = document.getElementById("custom-login-btn-mobile");
        if(customLoginBtnMobile) { customLoginBtnMobile.classList.remove("hidden"); customLoginBtnMobile.style.display = ""; }
        
        if(userProfile) userProfile.classList.add("hidden");
        if(navHistory) navHistory.classList.add("hidden");
        if(mobileNavHistory) mobileNavHistory.classList.add("hidden");
        
        const mobileProfileInfo = document.getElementById("mobile-profile-info");
        if(mobileProfileInfo) mobileProfileInfo.classList.add("hidden");
        
        if(btnDownloadPdf) btnDownloadPdf.classList.add("hidden");
        
        renderGoogleButtons();
    }
}

// Fungsi Keluar (Logout)
if(btnLogout) {
    btnLogout.addEventListener("click", () => {
        // Beri tahu Google bahwa user telah keluar (mencegah auto-login / One Tap nyangkut)
        google.accounts.id.disableAutoSelect();
        
        localStorage.removeItem("herbscan_token");
        localStorage.removeItem("herbscan_user");
        authToken = null;
        userData = null;
        updateAuthUI();
        if(profileDropdown) profileDropdown.classList.add("hidden");
        showToast("Anda telah keluar.");
        // Redirect jika di halaman riwayat atau jika ada overlay login
        if (typeof closeLoginModal === "function") {
            closeLoginModal();
        }
        if(window.location.pathname.includes("riwayat.html")) {
            window.location.href = "index.html";
        }
    });
}

// Toggle Dropdown Profil
if(userProfile) {
    userProfile.addEventListener("click", (e) => {
        // Jangan toggle kalau yang diklik adalah isi menu dropdown
        if (e.target.closest('#profile-dropdown')) return;
        if(profileDropdown) profileDropdown.classList.toggle("hidden");
    });
}

// Toggle Mobile Menu
if(mobileMenuBtn) {
    mobileMenuBtn.addEventListener("click", () => {
        if(mobileMenu) mobileMenu.classList.toggle("translate-x-full");
    });
}

// Tutup dropdown jika klik di luar
document.addEventListener("click", (e) => {
    if (userProfile && !userProfile.contains(e.target)) {
        if(profileDropdown) profileDropdown.classList.add("hidden");
    }
    
    // Tutup mobile menu jika klik di luar
    if (mobileMenu && mobileMenuBtn && !mobileMenu.contains(e.target) && !mobileMenuBtn.contains(e.target)) {
        if (!mobileMenu.classList.contains("translate-x-full")) {
            mobileMenu.classList.add("translate-x-full");
        }
    }
});


// ============================================================================
// 2. SISTEM RIWAYAT (HISTORY)
// ============================================================================

// Fungsi untuk load history di halaman riwayat.html
async function loadHistoryPage() {
    if (!historyListContainer) return;
    
    if (!authToken) {
        historyListContainer.innerHTML = `<div class="text-center text-gray-400 dark:text-gray-500 dark:text-gray-400 py-20"><i class="fa-solid fa-lock text-4xl mb-4 text-gray-400 dark:text-gray-500"></i><br>Anda harus login terlebih dahulu untuk melihat riwayat.</div>`;
        return;
    }
    
    historyListContainer.innerHTML = `<div class="text-center text-gray-400 dark:text-gray-500 py-20"><i class="fa-solid fa-spinner animate-spin text-3xl mb-3"></i><br>Memuat riwayat...</div>`;
    
    try {
        const res = await fetch(`${BACKEND_URL}/history`, {
            headers: {
                "Authorization": `Bearer ${authToken}`
            }
        });
        const data = await res.json();
        
        if (res.ok && data.status === "success") {
            if (data.data.length > 0) {
                const historyActions = document.getElementById('history-actions');
                if (historyActions) historyActions.classList.remove('hidden');
            }
            renderHistoryList(data.data);
        } else {
            historyListContainer.innerHTML = `<div class="text-center text-red-500 py-20">Gagal mengambil riwayat.</div>`;
        }
    } catch (err) {
        historyListContainer.innerHTML = `<div class="text-center text-red-500 py-20">Kesalahan jaringan.</div>`;
    }
}

function renderHistoryList(histories) {
    if (!historyListContainer) return;
    
    if (histories.length === 0) {
        historyListContainer.innerHTML = `<div class="text-center text-gray-400 dark:text-gray-500 py-20">Belum ada riwayat diagnosis yang disimpan.</div>`;
        const historyActions = document.getElementById('history-actions');
        if (historyActions) historyActions.classList.add('hidden');
        return;
    }
    
    historyListContainer.innerHTML = histories.map(h => {
        const date = new Date(h.created_at).toLocaleString('id-ID');
        const acc = (h.confidence * 100).toFixed(1);
        const imgUrl = h.image_filename ? (h.image_filename.startsWith('data:image') ? h.image_filename : `${BACKEND_URL}/uploads/${h.image_filename}`) : '';
        return `
            <div class="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl p-4 hover:bg-gray-50 dark:hover:bg-gray-750 transition flex flex-col relative group history-item" data-id="${h.id}">
                <div class="absolute top-4 right-4 z-10 flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button class="w-8 h-8 rounded-full bg-red-500/20 hover:bg-red-500 text-red-400 hover:text-white flex items-center justify-center transition" onclick="deleteHistory(${h.id}, event)" title="Hapus Riwayat">
                        <i class="fa-solid fa-trash-can text-sm"></i>
                    </button>
                </div>
                <div class="flex justify-between items-start cursor-pointer" onclick="showPDFPreview('${h.plant_name}', '${h.disease_class}', ${h.confidence}, \`${h.recommendation.replace(/"/g, '&quot;')}\`, '${imgUrl}', '${date}')">
                    <div class="flex gap-4 items-center">
                        <div class="flex items-center h-full pl-2" onclick="event.stopPropagation()">
                            <input type="checkbox" class="history-checkbox custom-checkbox" value="${h.id}" onchange="updateDeleteBtnStatus()">
                        </div>
                        ${imgUrl ? `<img src="${imgUrl}" class="w-16 h-16 rounded-lg object-cover border border-gray-400 dark:border-gray-600" crossorigin="anonymous">` : `<div class="w-16 h-16 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400 dark:text-gray-500"><i class="fa-solid fa-image"></i></div>`}
                        <div>
                            <h4 class="text-lg font-bold text-gray-900 dark:text-white">${h.plant_name} <span class="text-sm font-normal text-gray-400 dark:text-gray-500 dark:text-gray-400">(${acc}%)</span></h4>
                            <p class="text-emerald-400 font-medium text-sm">${h.disease_class}</p>
                        </div>
                    </div>
                    <span class="text-xs text-gray-400 dark:text-gray-500 text-right pr-10 mt-1"><i class="fa-regular fa-calendar-days"></i><br>${date.split(',')[0]}</span>
                </div>
                <div class="mt-4 pt-3 border-t border-gray-300 dark:border-gray-700 flex items-center justify-center gap-2 text-sm text-gray-400 dark:text-gray-500 dark:text-gray-400 hover:text-white transition cursor-pointer" onclick="showPDFPreview('${h.plant_name}', '${h.disease_class}', ${h.confidence}, \`${h.recommendation.replace(/"/g, '&quot;')}\`, '${imgUrl}', '${date}')">
                    <i class="fa-solid fa-file-pdf text-red-400"></i> Lihat & Unduh Laporan PDF
                </div>
            </div>
        `;
    }).join("");
}

// Variabel Global untuk PDF Preview
let currentPdfHtml = "";
let currentPdfFilename = "";

window.showPDFPreview = async function(plant, disease, confidence, recommendation, imgUrl, dateStr) {
    const modal = document.getElementById("report-preview-modal");
    const renderArea = document.getElementById("preview-render-area");
    
    if (!modal || !renderArea) return;
    
    // Tampilkan modal dengan status loading
    modal.classList.remove("hidden");
    renderArea.innerHTML = `<div class="flex-grow flex flex-col items-center justify-center h-[500px] text-gray-400 dark:text-gray-500"><i class="fa-solid fa-spinner animate-spin text-4xl mb-4 text-emerald-500"></i><p>Menyiapkan Pratinjau Laporan...</p></div>`;
    
    try {
        let imgBase64 = '';
        if (imgUrl) {
            const tempImg = new Image();
            tempImg.crossOrigin = "anonymous";
            tempImg.src = imgUrl;
            await new Promise(resolve => {
                tempImg.onload = () => {
                    const canvas = document.createElement("canvas");
                    canvas.width = tempImg.naturalWidth;
                    canvas.height = tempImg.naturalHeight;
                    canvas.getContext("2d").drawImage(tempImg, 0, 0);
                    imgBase64 = canvas.toDataURL("image/jpeg", 0.9);
                    resolve();
                };
                tempImg.onerror = resolve;
            });
        }
        
        const parsedHTML = parseRecommendationText(recommendation);
        
        // Dapatkan HTML persis seperti yang akan dicetak
        currentPdfHtml = buildPDFHTML(plant, disease, parsedHTML, imgBase64, dateStr);
        currentPdfFilename = `Laporan-HerbScan-${plant}-${new Date().getTime()}.pdf`;
        
        // Tampilkan di modal
        renderArea.innerHTML = currentPdfHtml;
        
    } catch(err) {
        console.error("PDF Preview Error:", err);
        renderArea.innerHTML = `<div class="text-center text-red-500 py-20"><p>Gagal memuat pratinjau PDF.<br><span class="text-sm">${err.message}</span></p></div>`;
    }
};

const btnClosePreview = document.getElementById("btn-close-preview");
const btnDownloadFromPreview = document.getElementById("btn-download-from-preview");

btnClosePreview?.addEventListener("click", () => {
    document.getElementById("report-preview-modal").classList.add("hidden");
});

btnDownloadFromPreview?.addEventListener("click", () => {
    if (!currentPdfHtml) return;
    
    const originalBtnHtml = btnDownloadFromPreview.innerHTML;
    btnDownloadFromPreview.innerHTML = '<i class="fa-solid fa-spinner animate-spin"></i> Mengunduh...';
    btnDownloadFromPreview.disabled = true;
    
    const opt = {
        margin:       [0.5, 0, 0.5, 0],
        filename:     currentPdfFilename,
        image:        { type: 'jpeg', quality: 1.0 },
        html2canvas:  { scale: 2, useCORS: true },
        jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' } 
    };

    html2pdf().set(opt).from(currentPdfHtml).save().then(() => {
        btnDownloadFromPreview.innerHTML = originalBtnHtml;
        btnDownloadFromPreview.disabled = false;
        showToast("PDF berhasil diunduh.");
    });
});

// Sistem Hapus Riwayat dengan Custom Modal
let pendingDeleteAction = null;

function showConfirmModal(message, actionCallback) {
    const modal = document.getElementById('delete-confirm-modal');
    const msgEl = document.getElementById('delete-confirm-message');
    const content = document.getElementById('delete-modal-content');
    
    if (!modal || !msgEl || !content) return;
    
    msgEl.textContent = message;
    pendingDeleteAction = actionCallback;
    
    // Tampilkan modal dengan animasi fade in & scale
    modal.classList.remove('hidden');
    
    // Pemicu animasi pada frame berikutnya
    requestAnimationFrame(() => {
        content.classList.remove('scale-95', 'opacity-0');
        content.classList.add('scale-100', 'opacity-100');
    });
}

function hideConfirmModal() {
    const modal = document.getElementById('delete-confirm-modal');
    const content = document.getElementById('delete-modal-content');
    
    if (!modal || !content) return;
    
    // Animasi fade out & scale down
    content.classList.remove('scale-100', 'opacity-100');
    content.classList.add('scale-95', 'opacity-0');
    
    setTimeout(() => {
        modal.classList.add('hidden');
        pendingDeleteAction = null;
    }, 300); // Sesuai durasi transisi di tailwind (duration-300)
}

document.getElementById('btn-cancel-delete')?.addEventListener('click', hideConfirmModal);
document.getElementById('btn-confirm-delete')?.addEventListener('click', () => {
    if (pendingDeleteAction) {
        pendingDeleteAction();
    }
    hideConfirmModal();
});

window.deleteHistory = function(id, event) {
    if (event) event.stopPropagation();
    
    showConfirmModal("Apakah Anda yakin ingin menghapus riwayat ini? Data yang dihapus tidak dapat dikembalikan.", async () => {
        try {
            const res = await fetch(`${BACKEND_URL}/history/${id}`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${authToken}` }
            });
            const data = await res.json();
            
            if (res.ok && data.status === "success") {
                showToast("Riwayat berhasil dihapus.");
                loadHistoryPage();
            } else {
                showToast(data.detail || "Gagal menghapus riwayat.", true);
            }
        } catch (err) {
            showToast("Terjadi kesalahan jaringan.", true);
        }
    });
};

window.updateDeleteBtnStatus = function() {
    const checkboxes = document.querySelectorAll('.history-checkbox:checked');
    const btnDeleteText = document.getElementById('text-delete-selected');
    const btnDelete = document.getElementById('btn-delete-selected');
    if (!btnDelete || !btnDeleteText) return;
    
    if (checkboxes.length > 0) {
        btnDelete.disabled = false;
        btnDelete.classList.remove("cursor-not-allowed", "opacity-50");
        btnDeleteText.innerHTML = `Hapus Terpilih (${checkboxes.length})`;
    } else {
        btnDelete.disabled = true;
        btnDelete.classList.add("cursor-not-allowed", "opacity-50");
        btnDeleteText.innerHTML = `Hapus Terpilih`;
    }
};

const btnSelectAll = document.getElementById('btn-select-all');
const textSelectAll = document.getElementById('text-select-all');
const btnDeleteSelected = document.getElementById('btn-delete-selected');

btnSelectAll?.addEventListener('click', () => {
    const checkboxes = document.querySelectorAll('.history-checkbox');
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    
    checkboxes.forEach(cb => cb.checked = !allChecked);
    updateDeleteBtnStatus();
    
    if (textSelectAll) {
        textSelectAll.textContent = allChecked ? "Pilih Semua" : "Batal Pilih Semua";
    }
});

btnDeleteSelected?.addEventListener('click', () => {
    const checkboxes = document.querySelectorAll('.history-checkbox:checked');
    if (checkboxes.length === 0) return;
    
    showConfirmModal(`Anda akan menghapus ${checkboxes.length} riwayat yang dipilih. Data yang dihapus tidak dapat dikembalikan.`, async () => {
        const ids = Array.from(checkboxes).map(cb => parseInt(cb.value));
        
        try {
            const res = await fetch(`${BACKEND_URL}/history/bulk-delete`, {
                method: "POST",
                headers: { 
                    "Authorization": `Bearer ${authToken}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ history_ids: ids })
            });
            const data = await res.json();
            
            if (res.ok && data.status === "success") {
                showToast(`${ids.length} riwayat berhasil dihapus.`);
                
                // Kembalikan teks "Pilih Semua"
                if (textSelectAll) textSelectAll.textContent = "Pilih Semua";
                
                loadHistoryPage();
            } else {
                showToast(data.detail || "Gagal menghapus riwayat.", true);
            }
        } catch (err) {
            showToast("Terjadi kesalahan jaringan.", true);
        }
    });
});



// Fungsi penyokong untuk menyimpan riwayat retroaktif secara diam-diam (background)
async function silentRetroactiveSave() {
    if (!currentFile || !authToken) return;
    
    // Buat overlay pemblokir layar agar user tidak pindah halaman sebelum selesai
    const overlay = document.createElement("div");
    overlay.className = "fixed inset-0 bg-gray-900/90 z-[9999] flex flex-col justify-center items-center backdrop-blur-sm";
    overlay.innerHTML = `<i class="fa-solid fa-cloud-arrow-up animate-bounce text-6xl text-emerald-400 mb-6"></i><p class="text-white font-bold text-2xl">Menyinkronkan Riwayat...</p><p class="text-gray-300 text-sm mt-2">Mohon tunggu sebentar, sedang mengamankan data Anda ke Cloud.</p>`;
    document.body.appendChild(overlay);

    try {
        // Gunakan lokasi terakhir jika ada, untuk mempercepat proses
        const locData = lastLocationData || await getLocation();
        const formData = new FormData();
        formData.append("file", currentFile);
        if(locData.location) formData.append("location", locData.location);
        if(locData.lat) formData.append("lat", locData.lat);
        if(locData.lng) formData.append("lng", locData.lng);

        const res = await fetch(`${BACKEND_URL}/predict`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${authToken}` },
            body: formData
        });
        if (res.ok) {
            showToast("Riwayat berhasil disimpan permanen secara otomatis!", false, 4000);
        }
    } catch(e) {
        console.error("Silent save error", e);
    } finally {
        document.body.removeChild(overlay);
    }
}

// ============================================================================
// 3. LOGIKA UPLOAD GAMBAR & KAMERA
// ============================================================================

// Klik untuk unggah pada kotak dropzone pertama kali
dropzone?.addEventListener("click", (e) => {
    if (e.target.closest('#remove-img-btn')) return;
    if (e.target === fileInput) return; // Cegah event bubbling dari fileInput.click()
    // Cegah klik dropzone jika gambar sudah ada
    if (currentFile) return;
    
    if (!authToken) {
        pendingAction = "upload";
        guestLoginModal.classList.remove("hidden");
    } else {
        if(fileInput) fileInput.click();
    }
});

fileInput?.addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
        handleFileSelect(e.target.files[0]);
    }
});

// Drag & Drop
dropzone?.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropzone.classList.add("border-emerald-400", "bg-emerald-900/20");
});
dropzone?.addEventListener("dragleave", () => {
    dropzone.classList.remove("border-emerald-400", "bg-emerald-900/20");
});
dropzone?.addEventListener("drop", (e) => {
    e.preventDefault();
    dropzone.classList.remove("border-emerald-400", "bg-emerald-900/20");
    if (e.dataTransfer.files.length > 0) {
        if (!authToken) {
            pendingAction = "drop";
            pendingDroppedFile = e.dataTransfer.files;
            guestLoginModal.classList.remove("hidden");
        } else {
            handleFileSelect(e.dataTransfer.files[0]);
            fileInput.files = e.dataTransfer.files;
        }
    }
});

function handleFileSelect(file) {
    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
    if (!validTypes.includes(file.type)) {
        showToast("Format file tidak didukung!", true);
        return;
    }

    currentFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
        imagePreview.src = e.target.result;
        dropzonePrompt.classList.add("hidden");
        previewContainer.classList.remove("hidden");
        
        detectBtn.disabled = false;
        
        // Reset kolom hasil ke Placeholder
        resultPlaceholder.classList.remove("hidden");
        resultLoading.classList.add("hidden");
        resultContent.classList.add("hidden");
    };
    reader.readAsDataURL(file);
}

// Hapus Gambar
removeImgBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    currentFile = null;
    fileInput.value = "";
    previewContainer.classList.add("hidden");
    dropzonePrompt.classList.remove("hidden");
    detectBtn.disabled = true;
});

// Aksi "Unggah Foto Baru"
btnNewPhoto?.addEventListener("click", () => {
    if (!authToken) {
        pendingAction = "upload";
        guestLoginModal.classList.remove("hidden");
    } else {
        fileInput.click();
    }
});

// Aksi "Gunakan Kamera"
btnOpenCamera?.addEventListener("click", () => {
    if (!authToken) {
        pendingAction = "camera";
        guestLoginModal.classList.remove("hidden");
    } else {
        openCamera();
    }
});

// Lanjutkan Tanpa Login (Guest)
btnContinueGuest?.addEventListener("click", () => {
    guestLoginModal.classList.add("hidden");
    if (pendingAction === "upload") {
        fileInput.click();
    } else if (pendingAction === "camera") {
        openCamera();
    } else if (pendingAction === "drop" && pendingDroppedFile) {
        handleFileSelect(pendingDroppedFile[0]);
        fileInput.files = pendingDroppedFile;
        pendingDroppedFile = null;
    }
    pendingAction = null;
});

// Logika Buka Kamera
async function openCamera() {
    cameraModal.classList.remove("hidden");
    cameraLoading.classList.remove("hidden");
    cameraStream.classList.add("hidden");
    btnCapturePhoto.disabled = true;

    try {
        mediaStream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: "environment" } 
        });
        cameraStream.srcObject = mediaStream;
        cameraStream.onloadedmetadata = () => {
            cameraLoading.classList.add("hidden");
            cameraStream.classList.remove("hidden");
            btnCapturePhoto.disabled = false;
        };
    } catch (err) {
        cameraLoading.innerHTML = `<span class="text-red-500 text-sm">Gagal mengakses kamera. Pastikan izin diberikan.</span>`;
    }
}

// Tutup Kamera
btnCloseCamera?.addEventListener("click", () => {
    closeCameraStream();
    cameraModal.classList.add("hidden");
});

function closeCameraStream() {
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
    }
}

// Jepret Foto
btnCapturePhoto?.addEventListener("click", () => {
    if (!mediaStream) return;
    
    // Set ukuran canvas sesuai stream video
    cameraCanvas.width = cameraStream.videoWidth;
    cameraCanvas.height = cameraStream.videoHeight;
    const ctx = cameraCanvas.getContext("2d");
    ctx.drawImage(cameraStream, 0, 0, cameraCanvas.width, cameraCanvas.height);
    
    // Konversi canvas ke File JPEG
    cameraCanvas.toBlob((blob) => {
        const file = new File([blob], "camera-capture.jpg", { type: "image/jpeg" });
        closeCameraStream();
        cameraModal.classList.add("hidden");
        
        // Buat mock DataTransfer untuk memasukkan File ke input[type=file]
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        fileInput.files = dataTransfer.files;
        
        // Panggil fungsi select
        handleFileSelect(file);
    }, "image/jpeg", 0.95);
});


// ============================================================================
// 4. LOGIKA DETEKSI / CALL BACKEND API
// ============================================================================

// Fungsi untuk mendapatkan lokasi dan nama kecamatan
async function getLocation() {
    return new Promise((resolve) => {
        if (!navigator.geolocation) {
            resolve({ location: "Tidak Diketahui", lat: null, lng: null });
            return;
        }
        
        navigator.geolocation.getCurrentPosition(async (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            
            try {
                // Reverse geocoding via Nominatim
                const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14`, {
                    headers: {
                        'Accept-Language': 'id'
                    }
                });
                const data = await res.json();
                
                let kec = "Tidak Diketahui";
                if (data && data.address) {
                    // Cari kecamatan dari properti yang dikembalikan
                    kec = data.address.suburb || data.address.village || data.address.town || data.address.city_district || data.address.county || "Tidak Diketahui";
                    
                    // Rapikan nama kecamatan
                    if (kec !== "Tidak Diketahui" && !kec.toLowerCase().includes("kecamatan")) {
                        kec = "Kecamatan " + kec;
                    }
                }
                resolve({ location: kec, lat: lat, lng: lng });
            } catch (e) {
                resolve({ location: "Tidak Diketahui", lat: lat, lng: lng });
            }
        }, (error) => {
            console.log("Akses lokasi ditolak atau gagal:", error);
            resolve({ location: "Tidak Diketahui", lat: null, lng: null });
        }, { timeout: 10000 });
    });
}

detectBtn?.addEventListener("click", async () => {
    if (!currentFile) return;

    // Ubah UI ke status Loading
    resultPlaceholder.classList.add("hidden");
    resultContent.classList.add("hidden");
    resultLoading.classList.remove("hidden");
    detectBtn.disabled = true;
    detectBtn.innerHTML = '<i class="fa-solid fa-spinner animate-spin"></i> Mendapatkan Lokasi...';

    // Ambil lokasi (jika ditolak, otomatis "Tidak Diketahui")
    const locData = await getLocation();
    lastLocationData = locData; // Simpan untuk retroactive save

    detectBtn.innerHTML = '<i class="fa-solid fa-spinner animate-spin"></i> Proses AI sedang berjalan...';

    const formData = new FormData();
    formData.append("file", currentFile);
    if(locData.location) formData.append("location", locData.location);
    if(locData.lat) formData.append("lat", locData.lat);
    if(locData.lng) formData.append("lng", locData.lng);

    try {
        const headers = {};
        if (authToken) {
            headers["Authorization"] = `Bearer ${authToken}`;
        }

        const res = await fetch(`${BACKEND_URL}/predict`, {
            method: "POST",
            headers: headers,
            body: formData
        });

        const data = await res.json();
        
        if (res.ok && data.status === "success") {
            displayResults(data);
            if (!authToken) {
                // Munculkan bujukan login jika Guest
                loginPromptArea.classList.remove("hidden");
            } else {
                loginPromptArea.classList.add("hidden");
            }
        } else {
            showToast(data.detail || "Terjadi kesalahan di server.", true);
            resetResultView();
        }
    } catch (err) {
        showToast("Gagal terhubung ke server. Pastikan backend sudah menyala.", true);
        resetResultView();
    } finally {
        detectBtn.disabled = false;
        detectBtn.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> Mulai Deteksi';
    }
});

function displayResults(data) {
    resultLoading.classList.add("hidden");
    resultContent.classList.remove("hidden");

    const plantGroup = document.getElementById("plant-info-group");
    const statusGroup = document.getElementById("status-info-group");
    const infoContainer = document.getElementById("info-penyakit-container");
    const recommendationBox = document.getElementById("recommendation-box");
    
    // Hapus alert lama jika ada
    const oldAlert = document.getElementById("not-recognized-alert");
    if (oldAlert) oldAlert.remove();

    if (data.plant === "Bukan Tanaman Rempah" || data.class_name === "Tidak Dikenali") {
        // --- TAMPILAN JIKA GAMBAR TIDAK DIKENALI ---
        plantGroup.classList.add("hidden");
        statusGroup.classList.add("hidden");
        recommendationBox.classList.add("hidden");
        updateGauge(0);
        
        const alertHtml = `
            <div id="not-recognized-alert" class="bg-red-500/20 border border-red-500 rounded-xl p-4 mt-2">
                <h3 class="text-xl font-bold text-red-400 mb-3 flex items-center gap-2">
                    <i class="fa-solid fa-triangle-exclamation"></i> Objek Tidak Dikenali
                </h3>
                <p class="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                    Sistem gagal memproses gambar ini. Pastikan Anda mengunggah <b>foto daun</b> dari tanaman <b>Jahe, Kapulaga, atau Kencur</b>.
                    <br><br>
                    <i class="text-gray-400 dark:text-gray-500 dark:text-gray-400">Catatan: Website HerbScan ini masih dalam tahap purwarupa (Versi Pertama) dan pelatihannya hanya difokuskan secara eksklusif untuk mendeteksi penyakit pada ketiga daun tanaman rempah tersebut. Objek di luar dari tiga daun ini tidak dapat diproses.</i>
                </p>
            </div>
        `;
        infoContainer.insertAdjacentHTML('afterbegin', alertHtml);

    } else {
        // --- TAMPILAN NORMAL (DIKENALI) ---
        plantGroup.classList.remove("hidden");
        statusGroup.classList.remove("hidden");
        recommendationBox.classList.remove("hidden");
        
        resPlant.textContent = data.plant;
        resStatus.textContent = data.class_name;
        
        // Ubah warna teks diagnosis jika penyakit
        if (data.class_name.toLowerCase().includes("sehat")) {
            resStatus.className = "text-xl font-black text-emerald-400";
        } else {
            resStatus.className = "text-xl font-black text-red-400";
        }

        // Update Circular Gauge
        updateGauge(data.confidence);

        // Format Rekomendasi
        resRecommendation.innerHTML = parseRecommendationText(data.recommendation);
    }
}

function updateGauge(confidenceFloat) {
    const percentage = Math.round(confidenceFloat * 100);
    resConfidence.textContent = `${percentage}%`;
    
    // Hitung dashoffset lingkaran
    const circumference = 2 * Math.PI * 45; // r=45 di SVG
    const offset = circumference - (percentage / 100) * circumference;
    progressRingBar.style.strokeDashoffset = offset;
    
    // Ubah warna ring
    if (percentage >= 90) progressRingBar.style.stroke = "#10b981"; // Emerald
    else if (percentage >= 70) progressRingBar.style.stroke = "#f59e0b"; // Amber
    else progressRingBar.style.stroke = "#ef4444"; // Red
}

function parseRecommendationText(text) {
    // Pecah teks berdasarkan angka 1., 2., 3. atau 1), 2), 3) atau 1] atau format list standar AI
    const parts = text.split(/(?:(?:1|2|3|4)[\.\)\]]\s)/).filter(p => p.trim() !== "");
    
    // Jika AI tidak mematuhi urutan 1, 2, 3 dengan tepat, kembalikan ke format biasa namun rapi
    if (parts.length < 3) {
        return `<div class="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 p-4 rounded-xl text-gray-600 dark:text-gray-300 leading-relaxed">${text.replace(/\n/g, '<br>')}</div>`;
    }
    
    const titles = [
        '<i class="fa-solid fa-eye text-blue-400"></i> Analisis Visual',
        '<i class="fa-solid fa-virus text-red-400"></i> Penyebab Penyakit',
        '<i class="fa-solid fa-leaf text-emerald-400"></i> Langkah Penanganan'
    ];

    let html = '<div class="grid grid-cols-1 gap-4 mt-2">';
    for (let i = 0; i < parts.length && i < 3; i++) {
        // Membersihkan prefix redundant dari jawaban AI jika AI masih bandel
        let cleanText = parts[i].trim()
            .replace(/^\[Analisis Visual\]\s*/i, "")
            .replace(/^\[Penyebab\]\s*/i, "")
            .replace(/^\[Langkah Penanganan\]\s*/i, "")
            .replace(/^Analisis Visual:\s*/i, "")
            .replace(/^Penyebab Penyakit:\s*/i, "")
            .replace(/^Langkah Penanganan:\s*/i, "");
            
        html += `
            <div class="bg-white dark:bg-gray-800/80 border border-gray-300 dark:border-gray-700/50 rounded-xl p-4 shadow-sm hover:border-gray-600 transition">
                <h5 class="font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">${titles[i]}</h5>
                <p class="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">${cleanText.replace(/\n/g, '<br>')}</p>
            </div>
        `;
    }
    html += '</div>';
    
    return html;
}

function resetResultView() {
    resultLoading.classList.add("hidden");
    resultPlaceholder.classList.remove("hidden");
}


// ============================================================================
// 5. FITUR EKSPOR PDF (CETAK LAPORAN) & PREVIEW
// ============================================================================
function buildPDFHTML(plantName, diseaseName, recommendationHTML, imgBase64, customDate = null) {
    const dateStr = customDate || new Date().toLocaleDateString('id-ID', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });

    // Susun Teks Rekomendasi (Omni-Parser: Handle Terstruktur maupun Raw Text)
    let recList = '';
    const recContainer = document.createElement('div');
    recContainer.innerHTML = recommendationHTML;
    
    // Cek apakah di dalam kotak rekomendasi terdapat judul (h4 / h5)
    const titles = recContainer.querySelectorAll('h4, h5');
    
    if (titles.length > 0) {
        // FORMAT TERSTRUKTUR (AI menjawab dengan pola 1, 2, 3)
        const blocks = recContainer.querySelectorAll('.grid > div');
        
        blocks.forEach(block => {
            const titleEl = block.querySelector('h4, h5');
            const contentEl = block.querySelector('p, ul');
            
            if (titleEl && contentEl) {
                const title = titleEl.textContent;
                const content = contentEl.innerHTML;
                
                recList += `
                    <div style="margin-bottom: 20px;">
                        <h3 style="font-size: 14px; font-weight: bold; color: #333; text-transform: uppercase; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-bottom: 5px;">${title}</h3>
                        <div style="font-size: 14px; color: #555; line-height: 1.6; margin: 0; text-align: justify; padding-left: 10px;">
                            ${content}
                        </div>
                    </div>
                `;
            }
        });
    } else {
        // FORMAT RAW TEXT (AI merespon secara utuh / gagal dipartisi)
        const rawText = recContainer.innerText || recContainer.textContent;
        recList += `
            <div style="margin-bottom: 20px;">
                <h3 style="font-size: 14px; font-weight: bold; color: #333; text-transform: uppercase; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-bottom: 5px;">Rekomendasi Penanganan</h3>
                <div style="font-size: 14px; color: #555; line-height: 1.6; margin: 0; text-align: justify;">
                    ${rawText.replace(/\n/g, '<br>')}
                </div>
            </div>
        `;
    }

    // Buat HTML Murni (Anti-Error)
    const pdfHtml = `
        <div style="width: 794px; padding: 40px; font-family: Arial, sans-serif; background: #fff; color: #000; box-sizing: border-box;">
            <!-- Header -->
            <div style="border-bottom: 4px solid #064e3b; padding-bottom: 15px; margin-bottom: 30px;">
                <h1 style="font-size: 28px; font-weight: bold; color: #064e3b; margin: 0; text-transform: uppercase;">HerbScan</h1>
                <p style="font-size: 14px; color: #666; margin: 5px 0 10px 0;">Sistem Deteksi Penyakit Daun Rempah AI</p>
                <p style="font-size: 14px; font-weight: bold; color: #444; margin: 0;">Tanggal Cetak: ${dateStr}</p>
            </div>

            <!-- Image -->
            <div style="text-align: center; margin-bottom: 30px;">
                <p style="font-size: 12px; font-weight: bold; color: #777; text-transform: uppercase; margin-bottom: 10px;">Foto Objek Observasi</p>
                <img src="${imgBase64 || ''}" style="width: 250px; height: 250px; object-fit: cover; border: 2px solid #ddd; border-radius: 8px; ${imgBase64 ? '' : 'display: none;'}" />
            </div>

            <!-- Diagnosis -->
            <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 10px; padding: 20px; margin-bottom: 30px;">
                <h2 style="font-size: 18px; font-weight: bold; color: #065f46; text-transform: uppercase; border-bottom: 2px solid #a7f3d0; padding-bottom: 10px; margin-top: 0; margin-bottom: 20px;">Hasil Diagnosis Klinis</h2>
                <div style="margin-bottom: 15px;">
                    <p style="font-size: 12px; color: #666; text-transform: uppercase; margin: 0 0 5px 0;">Tanaman Terdeteksi</p>
                    <p style="font-size: 22px; font-weight: bold; color: #065f46; margin: 0;">${plantName}</p>
                </div>
                <div>
                    <p style="font-size: 12px; color: #666; text-transform: uppercase; margin: 0 0 5px 0;">Status Kesehatan / Penyakit</p>
                    <p style="font-size: 20px; font-weight: bold; color: #dc2626; margin: 0;">${diseaseName}</p>
                </div>
            </div>

            <!-- Recommendations -->
            <div style="margin-bottom: 40px;">
                <h2 style="font-size: 18px; font-weight: bold; color: #333; text-transform: uppercase; border-bottom: 2px solid #ddd; padding-bottom: 10px; margin-top: 0; margin-bottom: 20px;">Detail Observasi & Rekomendasi Penanganan</h2>
                ${recList}
            </div>

            <!-- Footer -->
            <div style="border-top: 2px solid #ddd; padding-top: 15px; text-align: center;">
                <p style="font-size: 12px; color: #777; margin: 0 0 5px 0;">Dicetak secara otomatis oleh sistem HerbScan.</p>
                <p style="font-size: 14px; font-weight: bold; color: #064e3b; margin: 0;">Dokumen Elektronik Valid</p>
            </div>
        </div>
    `;

    return pdfHtml;
}

btnDownloadPdf?.addEventListener("click", async () => {
    const btnDownloadPdf = document.getElementById('btn-download-pdf');
    const originalBtnHtml = btnDownloadPdf.innerHTML;
    
    try {
        btnDownloadPdf.innerHTML = '<i class="fa-solid fa-spinner animate-spin"></i> Menyusun Laporan...';
        btnDownloadPdf.disabled = true;

        const plantName = document.getElementById('result-plant').textContent;
        const diseaseName = document.getElementById('result-status').textContent;
        
        const previewImgElement = document.getElementById('image-preview');
        let imgBase64 = "";
        
        if (previewImgElement && previewImgElement.src) {
            try {
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = previewImgElement.naturalWidth || previewImgElement.width || 250;
                tempCanvas.height = previewImgElement.naturalHeight || previewImgElement.height || 250;
                const ctx = tempCanvas.getContext('2d');
                ctx.drawImage(previewImgElement, 0, 0, tempCanvas.width, tempCanvas.height);
                imgBase64 = tempCanvas.toDataURL('image/jpeg', 0.9);
            } catch (canvasErr) {
                console.error("Canvas error:", canvasErr);
            }
        }

        const recContainer = document.getElementById('result-recommendation');
        const pdfHtml = buildPDFHTML(plantName, diseaseName, recContainer.innerHTML, imgBase64);
        
        const opt = {
            margin:       [0.5, 0, 0.5, 0],
            filename:     `Laporan-HerbScan-${new Date().getTime()}.pdf`,
            image:        { type: 'jpeg', quality: 1.0 },
            html2canvas:  { scale: 2, useCORS: true },
            jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' } 
        };

        if (typeof html2pdf === 'undefined') {
            throw new Error("Library html2pdf belum dimuat oleh browser. Pastikan koneksi internet lancar.");
        }

        await html2pdf().set(opt).from(pdfHtml).save();
        
        btnDownloadPdf.innerHTML = originalBtnHtml;
        btnDownloadPdf.disabled = false;
        showToast("PDF berhasil diunduh.");
        
    } catch (err) {
        console.error("PDF generation error:", err);
        showToast(err.message || "Gagal memproses PDF.", true);
        btnDownloadPdf.innerHTML = originalBtnHtml;
        btnDownloadPdf.disabled = false;
    }
});


// ============================================================================
// 6. UTILITIES (TOAST)
// ============================================================================

function showToast(message, isError = false) {
    toastMessage.textContent = message;
    
    if (isError) {
        toast.classList.remove("border-emerald-500", "text-emerald-500");
        toast.classList.add("border-red-500", "text-red-500");
        toast.innerHTML = `<i class="fa-solid fa-circle-exclamation text-red-500"></i> <span>${message}</span>`;
    } else {
        toast.classList.remove("border-red-500", "text-red-500");
        toast.classList.add("border-emerald-500", "text-emerald-500");
        toast.innerHTML = `<i class="fa-solid fa-circle-check text-emerald-500"></i> <span>${message}</span>`;
    }

    // Munculkan toast
    toast.classList.remove("translate-x-[150%]");
    
    setTimeout(() => {
        toast.classList.add("translate-x-[150%]");
    }, 4000);
}

// Inisialisasi awal
document.addEventListener("DOMContentLoaded", () => {
    updateAuthUI();
    
    // Cek apakah ada request load riwayat dari halaman riwayat.html
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("from") === "history") {
        const historyDataStr = localStorage.getItem("herbscan_temp_history");
        if (historyDataStr) {
            const data = JSON.parse(historyDataStr);
            
            if (data.imgUrl && imagePreview) {
                currentFile = "HISTORY_IMAGE";
                imagePreview.src = data.imgUrl;
                if(dropzonePrompt) dropzonePrompt.classList.add("hidden");
                if(previewContainer) previewContainer.classList.remove("hidden");
                if(detectBtn) detectBtn.disabled = false;
            }
            
            if(resultPlaceholder) resultPlaceholder.classList.add("hidden");
            if(resultLoading) resultLoading.classList.add("hidden");
            if(resultContent) resultContent.classList.remove("hidden");
            if(newActionsContainer) newActionsContainer.classList.remove("hidden");
            
            const plantGroup = document.getElementById("plant-info-group");
            const statusGroup = document.getElementById("status-info-group");
            const infoContainer = document.getElementById("info-penyakit-container");
            const recommendationBox = document.getElementById("recommendation-box");
            
            if (data.plant === "Bukan Tanaman Rempah" || data.disease === "Tidak Dikenali") {
                if(plantGroup) plantGroup.classList.add("hidden");
                if(statusGroup) statusGroup.classList.add("hidden");
                if(recommendationBox) recommendationBox.classList.add("hidden");
                if(window.updateGauge) updateGauge(0);
                
                const alertHtml = `
                    <div id="not-recognized-alert" class="bg-red-500/20 border border-red-500 rounded-xl p-4 mt-2">
                        <h3 class="text-xl font-bold text-red-400 mb-3 flex items-center gap-2">
                            <i class="fa-solid fa-triangle-exclamation"></i> Objek Tidak Dikenali
                        </h3>
                        <p class="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                            Sistem gagal memproses gambar ini. Pastikan Anda mengunggah <b>foto daun</b> dari tanaman <b>Jahe, Kapulaga, atau Kencur</b>.
                        </p>
                    </div>
                `;
                if(infoContainer) infoContainer.insertAdjacentHTML('afterbegin', alertHtml);
            } else {
                if(plantGroup) plantGroup.classList.remove("hidden");
                if(statusGroup) statusGroup.classList.remove("hidden");
                if(recommendationBox) recommendationBox.classList.remove("hidden");
                
                if(resPlant) resPlant.textContent = data.plant;
                if(resStatus) resStatus.textContent = data.disease;
                if(window.updateGauge) updateGauge(data.confidence);
                if(resRecommendation && window.parseRecommendationText) {
                    resRecommendation.innerHTML = parseRecommendationText(data.recommendation);
                }
                
                if(resStatus) {
                    if (data.disease.toLowerCase().includes("sehat")) {
                        resStatus.className = "text-xl font-black text-emerald-400";
                    } else {
                        resStatus.className = "text-xl font-black text-red-400";
                    }
                }
            }
            
            if(loginPromptArea) loginPromptArea.classList.add("hidden");
            
            // Bersihkan URL agar tidak ter-load lagi jika di-refresh
            window.history.replaceState({}, document.title, "scanner.html");
        }
    }
    
    // Jika berada di halaman riwayat.html, muat data riwayat
    if (window.location.pathname.includes("riwayat.html")) {
        loadHistoryPage();
    }
});

// --- SISTEM TEMA (LIGHT / DARK MODE) ---
function updateThemeIcon() {
    const isDark = document.documentElement.classList.contains('dark');
    const toggles = document.querySelectorAll('.theme-toggle i');
    toggles.forEach(icon => {
        if (isDark) {
            icon.className = 'fa-solid fa-sun'; // Siang hari (saat dark aktif, ikon jadi matahari untuk beralih ke light)
        } else {
            icon.className = 'fa-solid fa-moon'; // Malam hari (saat light aktif, ikon jadi bulan)
        }
    });
}

// Inisialisasi ikon saat pertama load
document.addEventListener('DOMContentLoaded', updateThemeIcon);

// Event listener untuk semua tombol theme-toggle
document.querySelectorAll('.theme-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
        if (document.documentElement.classList.contains('dark')) {
            document.documentElement.classList.remove('dark');
            localStorage.theme = 'light';
        } else {
            document.documentElement.classList.add('dark');
            localStorage.theme = 'dark';
        }
        updateThemeIcon();
    });
});
