let lineChartInstance = null;
let pieChartInstance = null;
let rainChartInstance = null; // กราฟฝนก็เก็บ instance

let rainData = [], riceData = [];

const riceTypes = {
    "RiceMali": "ข้าวหอมมะลิ",
    "Long grain glutinous paddy rice": "ข้าวเหนียวเมล็ดยาว",
    "Short grain glutinous paddy rice": "ข้าวเหนียวเมล็ดสั้น"
};

const rainCSVUrl = "/static/rain.csv";
const riceCSVUrl = "/static/rice.csv";

async function loadCSV(url) {
    const response = await fetch(url);
    const text = await response.text();

    const parsed = Papa.parse(text, {
        header: true,
        skipEmptyLines: true
    });

    return parsed.data;
}

// ฟังก์ชันช่วย
function getUniqueYears(data) {
    return [...new Set(data.map(d => +d.YEAR))].sort();
}

function filterDataByYear(data, year) {
    return data.filter(d => +d.YEAR === +year);
}

function getUniqueProvinces(data) {
    return [...new Set(data.map(d => d.PROV_T))].sort();
}

function filterRainByProvinceYearAndMonth(data, province, year, month) {
    return data.filter(d => {
        const matchProvince = d.PROV_T === province;
        const matchYear = +d.YEAR === +year;
        if (month === 0) return matchProvince && matchYear;
        return matchProvince && matchYear && +d.MONTH === month;
    });
}

function filterDataByYearAndMonth(data, year, month) {
    return data.filter(d => {
        const matchYear = +d.YEAR === +year;
        if (month === 0) return matchYear;
        return matchYear && +d.MONTH === month;
    });
}
// update ราคาข้าว (line chart + pie chart) => ใช้ year + riceType
function updateRiceCharts() {
    const yearSelect = document.getElementById("yearSelect");
    const riceTypeSelect = document.getElementById("riceTypeSelect");
    const monthSelect = document.getElementById("monthSelect");

    const selectedYear = +yearSelect.value;
    const selectedRiceType = riceTypeSelect.value;
    const selectedMonth = +monthSelect.value;

    const filteredRice = filterDataByYearAndMonth(riceData, selectedYear, selectedMonth);

    renderLineChart(filteredRice, selectedYear, selectedRiceType, selectedMonth);
    renderHighchartsPieChart(filteredRice, selectedYear, selectedRiceType, selectedMonth);
}

// update กราฟฝน => ใช้ province + year
function updateRainChart() {
    const provinceSelect = document.getElementById("provinceSelect");
    const rainYearSelect = document.getElementById("rainYearSelect");
    const rainMonthSelect = document.getElementById("rainMonthSelect");

    const selectedProvince = provinceSelect.value;
    const selectedYear = +rainYearSelect.value;
    const selectedMonth = +rainMonthSelect.value;

    const filteredRain = filterRainByProvinceYearAndMonth(rainData, selectedProvince, selectedYear, selectedMonth);
    renderRainChart(filteredRain, selectedProvince, selectedYear, selectedMonth);
}


// โค้ด render (เหมือนเดิม)
function renderLineChart(data, year, riceType, selectedMonth = 0) {
    const canvas = document.getElementById("lineChart");
    const newCanvas = canvas.cloneNode(true);
    canvas.parentNode.replaceChild(newCanvas, canvas);

    const monthlyPrices = new Array(12).fill(null);

    data.forEach(d => {
        const month = +d.MONTH;
        if (selectedMonth !== 0 && month !== selectedMonth) return; // กรองเดือนถ้าเลือกเฉพาะเดือน
        const rawPrice = d[riceType] || "0";
        const cleanPrice = rawPrice.replace(/,/g, '');
        const price = parseFloat(cleanPrice);
        if (!isNaN(month) && !isNaN(price)) {
            monthlyPrices[month - 1] = price;
        }
    });

    // ถ้าเลือกเดือนเฉพาะ ให้แสดงแค่เดือนนั้นบนกราฟ (ไม่ต้อง 12 เดือน)
    let labels, dataToShow;
    if (selectedMonth !== 0) {
        labels = [`เดือน ${selectedMonth}`];
        dataToShow = [monthlyPrices[selectedMonth - 1]];
    } else {
        labels = [...Array(12)].map((_, i) => `เดือน ${i + 1}`);
        dataToShow = monthlyPrices;
    }

    const validPrices = dataToShow.filter(p => p !== null);
    const minPrice = validPrices.length ? Math.min(...validPrices) : 0;
    const maxPrice = validPrices.length ? Math.max(...validPrices) : 0;
    const minMonth = dataToShow.indexOf(minPrice) + 1;
    const maxMonth = dataToShow.indexOf(maxPrice) + 1;

    document.getElementById("minMaxText").textContent =
        selectedMonth !== 0
            ? `ราคาข้าว เดือน ${selectedMonth}: ${dataToShow[0]?.toLocaleString() || '-'} บาท`
            : `ราคาต่ำสุด: เดือน ${minMonth} (${minPrice.toLocaleString()} บาท), สูงสุด: เดือน ${maxMonth} (${maxPrice.toLocaleString()} บาท)`;

    const ctx = newCanvas.getContext('2d');
    lineChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: `ราคาข้าว ${riceTypes[riceType]} ปี ${year}`,
                data: dataToShow,
                borderColor: '#2980b9',
                backgroundColor: 'rgba(41, 128, 185, 0.2)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: `แนวโน้มราคาข้าว ${riceTypes[riceType]} ${selectedMonth !== 0 ? "เดือน " + selectedMonth : "รายเดือน"} ปี ${year}`
                }
            }
        }
    });
}

// แก้ไข renderHighchartsPieChart (ถ้าต้องการรองรับเดือนเดียวก็กรองข้อมูล)
function renderHighchartsPieChart(data, year, riceType, selectedMonth = 0) {
    let filteredData = data;
    if (selectedMonth !== 0) {
        filteredData = data.filter(d => +d.MONTH === selectedMonth);
    }

    const quarters = { Q1: [], Q2: [], Q3: [], Q4: [] };
    filteredData.forEach(d => {
        const raw = d[riceType] || "0";
        const price = parseFloat(raw.replace(/,/g, ''));
        const month = +d.MONTH;

        if (month >= 1 && month <= 3) quarters.Q1.push(price);
        else if (month <= 6) quarters.Q2.push(price);
        else if (month <= 9) quarters.Q3.push(price);
        else quarters.Q4.push(price);
    });

    const seriesData = Object.entries(quarters).map(([q, prices]) => {
        const avg = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
        return { name: q, y: parseFloat(avg.toFixed(2)) };
    });

    Highcharts.chart('pieChart3D', {
        chart: {
            type: 'pie',
            options3d: { enabled: true, alpha: 45, beta: 0 },
            backgroundColor: null
        },
        title: {
            text: `ราคาข้าว ${riceTypes[riceType]} เฉลี่ยรายไตรมาส ปี ${year}${selectedMonth !== 0 ? ` เดือน ${selectedMonth}` : ""}`
        },
        tooltip: {
            pointFormat: '<b>{point.y:.2f} บาท</b> ({point.percentage:.1f}%)'
        },
        plotOptions: {
            pie: {
                depth: 45,
                dataLabels: {
                    enabled: true,
                    format: '{point.name}: {point.percentage:.1f} %'
                }
            }
        },
        series: [{ name: 'ราคาเฉลี่ย', data: seriesData }]
    });
}

function renderRainChart(data, province, year, selectedMonth = 0) {
    const canvas = document.getElementById("rainChart");
    const newCanvas = canvas.cloneNode(true);
    canvas.parentNode.replaceChild(newCanvas, canvas);
    const ctx = newCanvas.getContext("2d");

    let labels = [], rainfallData = [];

    if (selectedMonth !== 0) {
        const rainValue = data.length > 0 ? parseFloat(data[0].AvgRain || 0) : 0;
        labels = [`เดือน ${selectedMonth}`];
        rainfallData = [rainValue];
    } else {
        labels = [...Array(12)].map((_, i) => `เดือน ${i + 1}`);
        rainfallData = new Array(12).fill(0);
        data.forEach(d => {
            const month = +d.MONTH;
            const rain = parseFloat(d.AvgRain || 0);
            if (!isNaN(month) && !isNaN(rain)) {
                rainfallData[month - 1] = rain;
            }
        });
    }

    rainChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: `ปริมาณฝนเฉลี่ย ${province} ปี ${year}${selectedMonth !== 0 ? " เดือน " + selectedMonth : ""} (มม.)`,
                data: rainfallData,
                borderColor: '#27ae60',
                backgroundColor: 'rgba(39, 174, 96, 0.2)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: `แนวโน้มปริมาณฝนเฉลี่ย ${province} รายเดือน ปี ${year}`
                }
            }
        }
    });
}

async function initDashboard() {
    [rainData, riceData] = await Promise.all([
        loadCSV(rainCSVUrl),
        loadCSV(riceCSVUrl)
    ]);

    const riceYears = getUniqueYears(riceData);
    const rainYears = getUniqueYears(rainData);  // เอาปีของข้อมูลฝนมาใช้
    const provinces = getUniqueProvinces(rainData);

    const yearSelect = document.getElementById("yearSelect");
    const riceTypeSelect = document.getElementById("riceTypeSelect");
    const provinceSelect = document.getElementById("provinceSelect");
    const rainYearSelect = document.getElementById("rainYearSelect");
    const rainMonthSelect = document.getElementById("rainMonthSelect");

    // เติมปีราคาข้าว
    riceYears.forEach(y => {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y;
        yearSelect.appendChild(opt);
    });

    // เติมชนิดข้าว
    Object.entries(riceTypes).forEach(([key, label]) => {
        const opt = document.createElement('option');
        opt.value = key;
        opt.textContent = label;
        riceTypeSelect.appendChild(opt);
    });

    // เติมจังหวัด
    provinces.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p;
        opt.textContent = p;
        provinceSelect.appendChild(opt);
    });

    // เติมปีฝน
    rainYears.forEach(y => {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y;
        rainYearSelect.appendChild(opt);
    });

    // เติมเดือนฝน
    for (let m = 0; m <= 12; m++) {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m === 0 ? "ทั้งหมด" : `เดือน ${m}`;
        rainMonthSelect.appendChild(opt);
    }

    // ตั้งค่า default
    yearSelect.value = riceYears[0];
    riceTypeSelect.value = Object.keys(riceTypes)[0];
    provinceSelect.value = provinces[0];
    rainYearSelect.value = rainYears[0];
    rainMonthSelect.value = 0;

    // event listener
    yearSelect.addEventListener("change", () => {
        updateRiceCharts();
        updateRainChart();
    });
    riceTypeSelect.addEventListener("change", updateRiceCharts);
    provinceSelect.addEventListener("change", updateRainChart);
    rainYearSelect.addEventListener("change", updateRainChart);
    rainMonthSelect.addEventListener("change", updateRainChart);

    // render ครั้งแรก
    updateRiceCharts();
    updateRainChart();
}

initDashboard();
