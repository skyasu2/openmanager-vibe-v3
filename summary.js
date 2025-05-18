// summary.js (데이터 로드 부분 수정)

// 전역 또는 모듈 스코프에 데이터 로드
// fixed_dummy_data.js가 전역으로 getFixedDummyData 함수를 제공한다고 가정
// 또는, import getFixedDummyData from './fixed_dummy_data.js'; 와 같이 모듈로 가져올 수 있음

let allServerDataForSummary = []; // summary.js 용 데이터 저장
let dataProcessor = null; // summary.js 용 dataProcessor 인스턴스

async function initDashboard() { // async 키워드는 이제 필수는 아님 (파일 직접 로드가 아니므로)
    try {
        // HTML에서 fixed_dummy_data.js가 먼저 로드되었다고 가정
        if (typeof getFixedDummyData !== 'function') {
            console.error("getFixedDummyData 함수를 찾을 수 없습니다. fixed_dummy_data.js가 로드되었는지 확인하세요.");
            showError("필수 데이터 파일을 로드할 수 없습니다.");
            return;
        }
        allServerDataForSummary = getFixedDummyData();
        
        if (!allServerDataForSummary || allServerDataForSummary.length === 0) {
            showError("서버 데이터를 로드할 수 없습니다.");
            return;
        }
        
        dataProcessor = new ServerDataProcessor(allServerDataForSummary); // 새 데이터로 초기화
        
        updateStatusSummary();
        updateServerList();
        initCharts(); // 차트 데이터도 새 구조에 맞게 dataProcessor 내부 메소드가 수정되어야 함
        displayRecentAlerts(); // 알림 데이터도 새 구조에 맞게 수정
        // setupAutoRefresh(); // 고정 데이터이므로 자동 새로고침 의미가 적을 수 있음. 필요시 유지.
        setupEventListeners();
        hideLoading();
        console.log("대시보드가 성공적으로 초기화되었습니다 (고정 데이터 사용).");
    } catch (error) {
        console.error("대시보드 초기화 중 오류 발생:", error);
        showError("대시보드를 초기화하는 중 오류가 발생했습니다.");
        hideLoading(); // 오류 발생 시에도 로딩 숨김
    }
}

// loadServerData 함수는 삭제하거나 위와 같이 수정합니다.
// async function loadServerData(fileName) { ... } // 이 함수는 이제 사용되지 않습니다.

// updateStatusSummary, updateServerList, initCharts, displayRecentAlerts 등
// 내부에서 dataProcessor의 메소드를 호출할 때, 해당 메소드들이
// 새로운 데이터 구조(serverHostname, stats, alerts 등)를 올바르게 처리하도록
// data_processor.js 내부에서 수정되었다고 가정합니다.

// 예시: updateServerList에서 server.serverName -> server.serverHostname
// 예시: formatAlertCount에서 alerts 배열 구조 사용

function updateServerList() {
    if (!dataProcessor) return;
    const serverListElement = document.getElementById('serverList');
    if (!serverListElement) return;
    serverListElement.innerHTML = '';
    
    // getCurrentStatusSummary는 각 서버의 최신 상태를 반환 (data_processor.js에 구현 필요)
    const currentStatus = dataProcessor.getCurrentStatusSummary(); 
    
    Object.values(currentStatus)
        .sort((a, b) => {
            // 정렬 로직 (심각도 점수 계산을 위해 통합 함수에서 반환된 값 활용)
            const aStatus = window.getServerStatus ? window.getServerStatus(a) : a.status;
            const bStatus = window.getServerStatus ? window.getServerStatus(b) : b.status;
            
            const aSeverityScore = (aStatus === 'Critical' || aStatus === 'critical') ? 2 : ((aStatus === 'Warning' || aStatus === 'warning') ? 1 : 0);
            const bSeverityScore = (bStatus === 'Critical' || bStatus === 'critical') ? 2 : ((bStatus === 'Warning' || bStatus === 'warning') ? 1 : 0);
            
            if (aSeverityScore !== bSeverityScore) return bSeverityScore - aSeverityScore;
            return b.stats.cpuUsage - a.stats.cpuUsage; // CPU 높은 순
        })
        .slice(0, 10)
        .forEach(server => { // server 객체는 이제 fixed_dummy_data의 구조를 따름
            const row = document.createElement('tr');
            
            // 통합 서버 상태 판단 함수 사용
            const serverStatus = window.getServerStatus ? window.getServerStatus(server) : server.status;
            
            let rowClass = '';
            if (serverStatus === 'Critical' || serverStatus === 'critical') rowClass = 'critical';
            else if (serverStatus === 'Warning' || serverStatus === 'warning') rowClass = 'warning';
            row.className = rowClass;
            
            const timestamp = new Date(server.timestamp);
            const formattedTime = `${timestamp.getFullYear()}-${String(timestamp.getMonth() + 1).padStart(2, '0')}-${String(timestamp.getDate()).padStart(2, '0')} ${String(timestamp.getHours()).padStart(2, '0')}:${String(timestamp.getMinutes()).padStart(2, '0')}`;
            
            row.innerHTML = `
                <td><span class="server-status ${serverStatus.toLowerCase()}"></span> ${server.serverHostname}</td>
                <td>${server.serverType}</td>
                <td>${server.stats.cpuUsage.toFixed(1)}%</td>
                <td>${server.stats.memoryUsage.toFixed(1)}%</td>
                <td>${formattedTime}</td>
                <td>${formatAlertCount(server.alerts)}</td> 
            `;
            // IP 주소, 디스크 사용량 등 추가 정보 표시 가능
            // <td>${server.ip}</td>
            // <td>${server.stats.diskUsage.toFixed(1)}%</td>
            serverListElement.appendChild(row);
        });
}

// 서버 상태 클래스 (통합 함수 사용)
function getServerStatusClass(server) { // server 객체는 fixed_dummy_data의 단일 항목
    if (window.getServerStatus) {
        return window.getServerStatus(server).toLowerCase();
    }
    return server.status.toLowerCase();
}

// 알림 수 포맷팅 (alerts 배열 사용)
function formatAlertCount(alertsArray) { // alertsArray는 item.alerts
    if (!alertsArray || alertsArray.length === 0) return '-';
    
    const criticalCount = alertsArray.filter(alert => alert.severity === 'critical').length;
    const warningCount = alertsArray.filter(alert => alert.severity === 'warning').length;
    // info 레벨도 있다면 추가
    
    if (criticalCount > 0) {
        return `<span class="badge critical">${criticalCount}</span>`;
    } else if (warningCount > 0) {
        return `<span class="badge warning">${warningCount}</span>`;
    } else {
        // 정보성 알림이나, 단순 알림 개수 표시
        return `<span class="badge info">${alertsArray.length}</span>`;
    }
}

// 차트 초기화 및 업데이트 함수 (initStatusChart, initCpuTrendChart 등) 내부에서
// dataProcessor.getServerCountByStatus(), dataProcessor.getHourlySystemStatus() 등을 호출할 때,
// 해당 data_processor.js의 메소드들이 새 데이터 구조에 맞게 수정되어야 합니다.
// 예를 들어, getHourlySystemStatus는 item.stats.cpuUsage 등을 사용해야 합니다.

function displayRecentAlerts() {
    if (!dataProcessor) return;
    const alertsContainer = document.getElementById('recentAlerts');
    if (!alertsContainer) return;
    alertsContainer.innerHTML = '';

    // rawData에서 alerts가 있는 항목들만 필터링 후 최신순 정렬
    const alertRecords = dataProcessor.rawData 
        .filter(record => record.alerts && record.alerts.length > 0)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    if (alertRecords.length === 0) {
        alertsContainer.innerHTML = '<div class="no-alerts">표시할 알림이 없습니다.</div>';
        return;
    }

    let alertDisplayCount = 0;
    for (const record of alertRecords) {
        for (const alert of record.alerts) { // record.alerts는 배열
            if (alertDisplayCount >= 15) break;

            const alertTime = new Date(record.timestamp);
            const timeString = `${String(alertTime.getHours()).padStart(2, '0')}:${String(alertTime.getMinutes()).padStart(2, '0')}`;
            const severityClass = alert.severity; // 'critical', 'warning', 'info' 등

            const alertItem = document.createElement('div');
            alertItem.className = `alert-item ${severityClass}`;
            alertItem.innerHTML = `
                <div class="alert-time">${timeString}</div>
                <div class="alert-badge">${alert.severity.charAt(0).toUpperCase() + alert.severity.slice(1)}</div>
                <div class="alert-content">
                    <div class="alert-server">${record.serverHostname} (${record.serverType})</div>
                    <div class="alert-message">${alert.message}</div>
                </div>
            `;
            alertsContainer.appendChild(alertItem);
            alertDisplayCount++;
        }
        if (alertDisplayCount >= 15) break;
    }
}


// setupAutoRefresh 함수는 고정 데이터이므로 주석 처리하거나 삭제하는 것을 고려
// function setupAutoRefresh() { ... }

// ... (나머지 함수들, 특히 차트 업데이트 시 data_processor.js의 변경된 메소드 결과 사용)
// updateStatusChart, updateCpuTrendChart 등에서 사용하는 dataProcessor의 메소드들이
// 새로운 데이터 구조(fixed_dummy_data)를 잘 처리하도록 수정되어야 합니다.
// (data_processor.js 내부에서 처리)

document.addEventListener('DOMContentLoaded', initDashboard);
