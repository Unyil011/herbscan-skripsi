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

const filterMonth = document.getElementById("filter-month");
const filterYear = document.getElementById("filter-year");
const btnFilter = document.getElementById("btn-filter");
const btnExport = document.getElementById("btn-export");

// Chart Instances & Map
let diseaseChartInstance = null;
let trendChartInstance = null;
let leafletMap = null;
let rawHistoryData = [];

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
            client_id: "687002073142-b9e3b4p6sifg93g6e9okgcl8i21s1gco.apps.googleusercontent.com",
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
    const month = filterMonth.value;
    const year = filterYear.value;
    
    let query = "?";
    if (month) query += `month=${month}&`;
    if (year) query += `year=${year}`;
    
    try {
        // 1. Fetch Stats
        const statRes = await fetch(`${BACKEND_URL}/admin/stats${query}`, {
            headers: { "Authorization": `Bearer ${authToken}` }
        });
        
        if (statRes.status === 401 || statRes.status === 403) {
            loginError.textContent = "Akses Ditolak: Anda bukan Admin.";
            loginError.classList.remove("hidden");
            // Hapus token jika nyasar
            setTimeout(doLogout, 2000);
            return;
        }
        
        const statData = await statRes.json();
        if (statData.status === "success") {
            loginOverlay.classList.add("hidden"); // Sukses, sembunyikan overlay
            renderStats(statData.data);
            renderCharts(statData.data);
            renderMap(statData.data.map_points);
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
        
    } catch (e) {
        console.error(e);
        alert("Gagal memuat data dasbor.");
    }
}

btnFilter.addEventListener("click", loadDashboardData);

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

    // Line Chart Trend
    const ctxTrend = document.getElementById('trendChart').getContext('2d');
    if (trendChartInstance) trendChartInstance.destroy();
    
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"];
    let labels = monthNames;
    let values = new Array(12).fill(0);
    
    if (data.monthly_trends && data.monthly_trends.length > 0) {
        data.monthly_trends.forEach(t => {
            values[t.month - 1] = t.count;
        });
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
        tableBody.innerHTML = `<tr><td colspan="6" class="px-4 py-8 text-center text-gray-500">Tidak ada data pada periode ini.</td></tr>`;
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
        `;
        tableBody.appendChild(tr);
    });
}

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
