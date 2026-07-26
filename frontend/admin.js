const BACKEND_URL = "https://herbscan-skripsi.vercel.app";
let authToken = localStorage.getItem("herbscan_token");
let userData = JSON.parse(localStorage.getItem("herbscan_user"));

// UI Elements
const loginOverlay = document.getElementById("login-overlay");
const loginError = document.getElementById("login-error");
const btnLogout = document.getElementById("btn-logout");
const btnLogoutMobile = document.getElementById("btn-logout-mobile");

const statUsers = document.getElementById("stat-users");
const statScans = document.getElementById("stat-scans");
const statTopDisease = document.getElementById("stat-top-disease");
const statTopPlant = document.getElementById("stat-top-plant");
const tableBody = document.getElementById("table-body");

const filterStartDate = document.getElementById("filter-start-date");
const filterEndDate = document.getElementById("filter-end-date");
const filterLocation = document.getElementById("filter-location");
const btnFilter = document.getElementById("btn-filter");
const btnExport = document.getElementById("btn-export");
const pageTitle = document.getElementById("page-title");
const tableUsersBody = document.getElementById("table-users-body");

// Chart Instances & Map
let diseaseChartInstance = null;
let trendChartInstance = null;
let leafletMap = null;
let rawHistoryData = [];

// Set Default Tanggal ke Bulan Ini
const today = new Date();
const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
if(filterStartDate && filterEndDate) {
    filterStartDate.value = firstDay.toISOString().split('T')[0];
    filterEndDate.value = today.toISOString().split('T')[0];
}

// ==========================================
// 0. NAVIGASI TAB
// ==========================================
window.switchView = function(viewId) {
    // Sembunyikan semua view
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
    const targetView = document.getElementById(`view-${viewId}`);
    if(targetView) targetView.classList.remove('hidden');
    
    // Update Desktop Tabs
    document.querySelectorAll('.tab-btn').forEach(el => {
        el.classList.remove('bg-emerald-50', 'dark:bg-emerald-900/30', 'text-emerald-600', 'dark:text-emerald-400');
        el.classList.add('text-gray-600', 'dark:text-gray-400', 'hover:bg-gray-50', 'dark:hover:bg-gray-700/50');
    });
    const activeTab = document.getElementById(`nav-${viewId}`);
    if (activeTab) {
        activeTab.classList.remove('text-gray-600', 'dark:text-gray-400', 'hover:bg-gray-50', 'dark:hover:bg-gray-700/50');
        activeTab.classList.add('bg-emerald-50', 'dark:bg-emerald-900/30', 'text-emerald-600', 'dark:text-emerald-400');
    }

    // Update Mobile Tabs
    document.querySelectorAll('.tab-btn-mobile').forEach(el => {
        el.classList.remove('text-emerald-600', 'dark:text-emerald-400');
        el.classList.add('text-gray-500', 'dark:text-gray-400');
    });
    const activeMobileTab = document.getElementById(`mobile-nav-${viewId}`);
    if (activeMobileTab) {
        activeMobileTab.classList.remove('text-gray-500', 'dark:text-gray-400');
        activeMobileTab.classList.add('text-emerald-600', 'dark:text-emerald-400');
    }

    // Update Judul
    if (viewId === 'dashboard') pageTitle.textContent = "Ringkasan Pemantauan";
    if (viewId === 'history') pageTitle.textContent = "Data Laporan Deteksi";
    if (viewId === 'users') pageTitle.textContent = "Data Pengguna Terdaftar";

    // Fix map rendering bug saat hidden
    if (viewId === 'dashboard' && leafletMap) {
        setTimeout(() => leafletMap.invalidateSize(), 200);
    }
};

// ==========================================
// 1. TEMA (DARK/LIGHT MODE)
// ==========================================
function initTheme() {
    const isDark = localStorage.getItem('theme') === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (isDark) {
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
    } else {
        document.documentElement.classList.add('light');
        document.documentElement.classList.remove('dark');
    }
}
initTheme();

function toggleTheme() {
    if (document.documentElement.classList.contains('dark')) {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
        localStorage.setItem('theme', 'light');
    } else {
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
        localStorage.setItem('theme', 'dark');
    }
    // Re-render map tiles jika perlu, tapi OSM default sudah oke.
}
document.getElementById("theme-toggle")?.addEventListener("click", toggleTheme);
document.getElementById("theme-toggle-mobile")?.addEventListener("click", toggleTheme);

// ==========================================
// 2. OTENTIKASI & GOOGLE LOGIN
// ==========================================
window.onload = function () {
    if (!authToken) {
        // Render Google Login Button
        google.accounts.id.initialize({
            client_id: "287994839540-kf3i2d95ad5ef8m2gkhkeprivqqnt76f.apps.googleusercontent.com",
            callback: handleCredentialResponse
        });
        google.accounts.id.renderButton(
            document.getElementById("google-login-btn-admin"),
            { theme: "filled_blue", size: "large", text: "continue_with", width: 250 }
        );
    } else {
        // Coba load data, jika 403 berarti bukan admin
        loadDashboardData();
    }
};

async function handleCredentialResponse(response) {
    const googleToken = response.credential;
    loginError.classList.add("hidden");
    
    try {
        const res = await fetch(`${BACKEND_URL}/auth/google`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ credential: googleToken })
        });
        
        const data = await res.json();
        if (res.ok && data.status === "success") {
            authToken = data.token;
            userData = data.user;
            localStorage.setItem("herbscan_token", authToken);
            localStorage.setItem("herbscan_user", JSON.stringify(userData));
            
            loadDashboardData();
        } else {
            loginError.textContent = "Gagal memverifikasi login Google.";
            loginError.classList.remove("hidden");
        }
    } catch (err) {
        loginError.textContent = "Server tidak merespons.";
        loginError.classList.remove("hidden");
    }
}

function doLogout() {
    google.accounts.id.disableAutoSelect();
    localStorage.removeItem("herbscan_token");
    localStorage.removeItem("herbscan_user");
    authToken = null;
    userData = null;
    window.location.reload();
}
btnLogout?.addEventListener("click", doLogout);
btnLogoutMobile?.addEventListener("click", doLogout);

// ==========================================
// 3. LOAD DATA DASHBOARD
// ==========================================
async function loadDashboardData() {
    const start = filterStartDate.value;
    const end = filterEndDate.value;
    const loc = filterLocation.value;
    
    let query = "?";
    if (start) query += `start_date=${start}&`;
    if (end) query += `end_date=${end}&`;
    if (loc) query += `location=${encodeURIComponent(loc)}&`;
    
    try {
        // 1. Fetch Stats
        const statRes = await fetch(`${BACKEND_URL}/admin/stats${query}`, {
            headers: { "Authorization": `Bearer ${authToken}` }
        });
        
        if (statRes.status === 401 || statRes.status === 403) {
            loginError.textContent = "Akses Ditolak: Anda bukan Admin.";
            loginError.classList.remove("hidden");
            setTimeout(doLogout, 2000);
            return;
        }
        
        const statData = await statRes.json();
        if (statData.status === "success") {
            loginOverlay.classList.add("hidden");
            renderStats(statData.data);
            renderCharts(statData.data);
            renderMap(statData.data.map_points);
            
            // Populate Dropdown Kecamatan jika belum dipilih spesifik (saat init awal)
            if (!loc) {
                populateLocationFilter(statData.data.locations);
            }
        }
        
        // 2. Fetch History Table
        const histRes = await fetch(`${BACKEND_URL}/admin/history${query}`, {
            headers: { "Authorization": `Bearer ${authToken}` }
        });
        const histData = await histRes.json();
        if (histData.status === "success") {
            rawHistoryData = histData.data;
            renderTable(rawHistoryData);
        }

        // 3. Fetch Users
        const userRes = await fetch(`${BACKEND_URL}/admin/users`, {
            headers: { "Authorization": `Bearer ${authToken}` }
        });
        const userDataJSON = await userRes.json();
        if (userDataJSON.status === "success") {
            renderUsers(userDataJSON.data);
        }
        
    } catch (e) {
        console.error(e);
        alert("Gagal memuat data dasbor.");
    }
}

btnFilter.addEventListener("click", loadDashboardData);

// Memasukkan list kecamatan ke opsi filter secara dinamis
function populateLocationFilter(locations) {
    const currentVal = filterLocation.value;
    filterLocation.innerHTML = '<option value="">Semua Lokasi</option>';
    locations.forEach(l => {
        if(l.name) {
            const opt = document.createElement("option");
            opt.value = l.name;
            opt.textContent = l.name;
            if(l.name === currentVal) opt.selected = true;
            filterLocation.appendChild(opt);
        }
    });
}

// ==========================================
// 4. RENDER UI
// ==========================================
function renderStats(data) {
    statUsers.textContent = data.total_users.toLocaleString();
    statScans.textContent = data.total_scans.toLocaleString();
    
    if (data.diseases.length > 0) {
        statTopDisease.textContent = data.diseases[0].name;
    } else {
        statTopDisease.textContent = "-";
    }
    
    if (data.plants.length > 0) {
        statTopPlant.textContent = data.plants[0].name;
    } else {
        statTopPlant.textContent = "-";
    }
}

function renderCharts(data) {
    // Pie Chart Penyakit
    const ctxDisease = document.getElementById('diseaseChart').getContext('2d');
    if (diseaseChartInstance) diseaseChartInstance.destroy();
    
    const diseaseLabels = data.diseases.map(d => d.name);
    const diseaseValues = data.diseases.map(d => d.count);
    
    diseaseChartInstance = new Chart(ctxDisease, {
        type: 'doughnut',
        data: {
            labels: diseaseLabels,
            datasets: [{
                data: diseaseValues,
                backgroundColor: ['#EF4444', '#10B981', '#F59E0B', '#3B82F6', '#8B5CF6'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right', labels: { color: '#9CA3AF' } }
            }
        }
    });

    // Line Chart Trend (Harian)
    const ctxTrend = document.getElementById('trendChart').getContext('2d');
    if (trendChartInstance) trendChartInstance.destroy();
    
    let labels = [];
    let values = [];
    
    if (data.trends && data.trends.length > 0) {
        data.trends.forEach(t => {
            labels.push(t.date);
            values.push(t.count);
        });
    } else {
        // Fallback agar chart tidak kosong total jika tak ada data
        labels = ["Hari ini"];
        values = [0];
    }

    trendChartInstance = new Chart(ctxTrend, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Jumlah Deteksi',
                data: values,
                borderColor: '#10B981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(156, 163, 175, 0.1)' }, ticks: { color: '#9CA3AF', stepSize: 1 } },
                x: { grid: { display: false }, ticks: { color: '#9CA3AF' } }
            }
        }
    });
}

function renderMap(points) {
    if (!leafletMap) {
        // Inisialisasi Peta (Center di Cianjur)
        leafletMap = L.map('map').setView([-6.8167, 107.1417], 10);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(leafletMap);
    }
    
    // Hapus marker lama
    leafletMap.eachLayer((layer) => {
        if (layer instanceof L.CircleMarker) {
            leafletMap.removeLayer(layer);
        }
    });

    // Tambah marker baru
    points.forEach(p => {
        if (p.lat && p.lng) {
            const isHealthy = p.disease.toLowerCase().includes("sehat");
            const color = isHealthy ? "#10B981" : "#EF4444";
            
            L.circleMarker([p.lat, p.lng], {
                radius: 8,
                fillColor: color,
                color: "#ffffff",
                weight: 1,
                opacity: 1,
                fillOpacity: 0.7
            }).addTo(leafletMap).bindPopup(`<b>Penyakit:</b> ${p.disease}`);
        }
    });
}

function renderTable(historyList) {
    tableBody.innerHTML = "";
    if (historyList.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" class="px-4 py-8 text-center text-gray-500">Tidak ada data pada periode ini.</td></tr>`;
        return;
    }
    
    historyList.forEach(h => {
        const isHealthy = h.disease.toLowerCase().includes("sehat");
        const badgeColor = isHealthy ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
        
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td class="px-4 py-3 border-b border-gray-100 dark:border-gray-800">${h.date.split(" ")[0]}</td>
            <td class="px-4 py-3 border-b border-gray-100 dark:border-gray-800 font-medium text-gray-900 dark:text-gray-100">${h.user}</td>
            <td class="px-4 py-3 border-b border-gray-100 dark:border-gray-800">${h.location}</td>
            <td class="px-4 py-3 border-b border-gray-100 dark:border-gray-800">${h.plant}</td>
            <td class="px-4 py-3 border-b border-gray-100 dark:border-gray-800"><span class="px-2 py-1 rounded-md text-xs font-bold ${badgeColor}">${h.disease}</span></td>
            <td class="px-4 py-3 border-b border-gray-100 dark:border-gray-800">${h.confidence}</td>
            <td class="px-4 py-3 border-b border-gray-100 dark:border-gray-800 text-center">
                <button onclick="deleteHistory(${h.id})" class="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 dark:bg-red-900/30 dark:hover:bg-red-900/50 p-2 rounded-lg transition" title="Hapus Laporan">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        `;
        tableBody.appendChild(tr);
    });
}

function renderUsers(usersList) {
    tableUsersBody.innerHTML = "";
    if (usersList.length === 0) {
        tableUsersBody.innerHTML = `<tr><td colspan="4" class="px-4 py-8 text-center text-gray-500">Belum ada pengguna terdaftar.</td></tr>`;
        return;
    }
    
    usersList.forEach(u => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td class="px-4 py-3 border-b border-gray-100 dark:border-gray-800 font-medium text-gray-900 dark:text-gray-100">${u.name}</td>
            <td class="px-4 py-3 border-b border-gray-100 dark:border-gray-800">${u.email}</td>
            <td class="px-4 py-3 border-b border-gray-100 dark:border-gray-800">${u.last_location}</td>
            <td class="px-4 py-3 border-b border-gray-100 dark:border-gray-800">${u.created_at.split(" ")[0]}</td>
        `;
        tableUsersBody.appendChild(tr);
    });
}

window.deleteHistory = async function(id) {
    if(!confirm("Apakah Anda yakin ingin menghapus laporan ini? Data yang dihapus tidak bisa dikembalikan.")) return;
    
    try {
        const res = await fetch(`${BACKEND_URL}/admin/history/${id}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${authToken}` }
        });
        const data = await res.json();
        
        if (res.ok && data.status === "success") {
            alert("Laporan berhasil dihapus!");
            loadDashboardData(); // Refresh ulang datanya
        } else {
            alert(data.detail || "Gagal menghapus laporan.");
        }
    } catch (err) {
        console.error(err);
        alert("Terjadi kesalahan pada server saat menghapus laporan.");
    }
};

// ==========================================
// 5. EXPORT KE EXCEL
// ==========================================
btnExport.addEventListener("click", () => {
    if (rawHistoryData.length === 0) {
        alert("Tidak ada data untuk diekspor.");
        return;
    }
    
    // Siapkan data untuk excel
    const excelData = rawHistoryData.map(h => ({
        "Tanggal": h.date,
        "Nama Pengguna": h.user,
        "Lokasi (Kecamatan)": h.location,
        "Tanaman": h.plant,
        "Diagnosis Penyakit": h.disease,
        "Akurasi AI": h.confidence
    }));
    
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Laporan Penyakit");
    
    // Download file
    XLSX.writeFile(workbook, `Laporan_HerbScan_${new Date().toISOString().split('T')[0]}.xlsx`);
});
