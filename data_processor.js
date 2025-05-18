/**
 * OpenManager AI - 데이터 처리기
 * 서버 데이터 처리, 페이지네이션, 필터링 및 UI 업데이트 로직을 구현합니다.
 */

class DataProcessor {
    constructor() {
        this.serverData = [];
        this.filteredData = [];
        this.currentFilter = 'all';
        this.currentSort = 'name';
        this.searchQuery = '';
        this.currentPage = 1;
        this.itemsPerPage = 10; // 페이지당 서버 수
        this.aiProcessor = window.aiProcessor || null;
        
        // 서버 상태 평가 임계값 - 통합 관리
        this.thresholds = {
            critical: {
                cpu: 90,
                memory: 90,
                disk: 90
            },
            warning: {
                cpu: 70,
                memory: 70,
                disk: 70
            }
        };
        
        // UI 요소 참조
        this.serverGrid = document.getElementById('server-grid');
        this.pagination = document.getElementById('pagination');
        this.loadingIndicator = document.getElementById('loading-indicator');
        this.filterButtons = document.querySelectorAll('.filter-btn');
        this.sortSelect = document.getElementById('sort-servers');
        this.searchInput = document.getElementById('search-server');
        this.refreshButton = document.querySelector('.refresh-data-btn');
        this.modalElement = document.getElementById('server-detail-modal');
        this.closeModalButton = document.getElementById('close-modal');
        
        // 이벤트 리스너 등록
        this.registerEventListeners();
        
        // 자동 데이터 업데이트 (1분 간격)
        setInterval(() => this.refreshData(), 60 * 1000);
        
        // 초기 데이터 로드
        this.loadData();
        
        // 서버 상태 판단 통합 로직을 전역 함수로 등록
        window.getServerStatus = (server) => this.getServerStatus(server);
    }
    
    registerEventListeners() {
        // 필터 버튼 이벤트
        this.filterButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                this.filterButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentFilter = btn.dataset.filter;
                this.currentPage = 1; // 필터 변경 시 첫 페이지로 리셋
                this.applyFiltersAndSort();
            });
        });
        
        // 정렬 변경 이벤트
        this.sortSelect.addEventListener('change', () => {
            this.currentSort = this.sortSelect.value;
            this.applyFiltersAndSort();
        });
        
        // 검색 이벤트
        this.searchInput.addEventListener('input', () => {
            this.searchQuery = this.searchInput.value.toLowerCase();
            this.currentPage = 1; // 검색 시 첫 페이지로 리셋
            this.applyFiltersAndSort();
        });
        
        // 새로고침 이벤트
        this.refreshButton.addEventListener('click', () => this.refreshData());
        
        // 모달 닫기 이벤트
        this.closeModalButton.addEventListener('click', () => this.closeModal());
        
        // 서버 데이터 업데이트 이벤트 리스너
        window.addEventListener('serverDataUpdated', (event) => {
            this.handleDataUpdate(event.detail);
        });
        
        // 초기 AI 도우미 기능 설정
        document.getElementById('ai-query-submit').addEventListener('click', () => this.processAIQuery());
        
        // AI 질문 제안 클릭 이벤트
        document.querySelectorAll('.ai-suggestion-tag').forEach(tag => {
            tag.addEventListener('click', () => {
                document.getElementById('ai-query-input').value = tag.dataset.query;
                this.processAIQuery();
            });
        });
        
        // 장애 보고서 다운로드 이벤트
        document.getElementById('download-report').addEventListener('click', () => this.downloadErrorReport());
    }
    
    loadData() {
        this.showLoading();
        
        // 데이터가 이미 로드되어 있으면 사용
        if (window.serverData && window.serverData.length > 0) {
            this.handleDataUpdate(window.serverData);
            return;
        }
        
        // 데이터 로드 시도 (최대 10초 대기)
        let attempts = 0;
        const checkInterval = setInterval(() => {
            if (window.serverData && window.serverData.length > 0) {
                clearInterval(checkInterval);
                this.handleDataUpdate(window.serverData);
                return;
            }
            
            attempts++;
            if (attempts >= 20) { // 10초 후 타임아웃 (500ms * 20)
                clearInterval(checkInterval);
                this.hideLoading();
                console.error('서버 데이터를 로드하지 못했습니다.');
                // 에러 메시지 표시
                this.serverGrid.innerHTML = `
                    <div class="alert alert-danger">
                        <i class="bi bi-exclamation-triangle"></i>
                        서버 데이터를 로드하지 못했습니다. 새로고침 버튼을 클릭하여 다시 시도해 주세요.
                    </div>
                `;
            }
        }, 500);
    }
    
    handleDataUpdate(data) {
        this.serverData = [...data]; // 데이터 복사
        this.hideLoading();
        
        // 추가 데이터 처리 (AI 분석 등)
        if (this.aiProcessor) {
            this.aiProcessor.updateData(this.serverData);
            this.updateProblemsList();
        }
        
        // 필터 및 정렬 적용
        this.applyFiltersAndSort();
    }
    
    refreshData() {
        this.showLoading();
        
        // 데이터가 업데이트되면 serverDataUpdated 이벤트로 처리됨
        // 하지만 10초 내에 업데이트가 없으면 현재 데이터로 UI 다시 로드
        setTimeout(() => {
            if (this.loadingIndicator.style.display !== 'none') {
                this.hideLoading();
                this.applyFiltersAndSort();
            }
        }, 10000);
    }
    
    showLoading() {
        this.loadingIndicator.style.display = 'block';
        this.serverGrid.style.opacity = '0.3';
    }
    
    hideLoading() {
        this.loadingIndicator.style.display = 'none';
        this.serverGrid.style.opacity = '1';
    }
    
    applyFiltersAndSort() {
        // 필터 적용
        this.filteredData = this.serverData.filter(server => {
            // 검색어 필터
            if (this.searchQuery && !server.hostname.toLowerCase().includes(this.searchQuery)) {
                return false;
            }
            
            // 상태 필터
            if (this.currentFilter !== 'all') {
                const status = this.getServerStatus(server);
                return status === this.currentFilter;
            }
            
            return true;
        });
        
        // 정렬 적용
        this.sortData();
        
        // UI 업데이트
        this.updateServerGrid();
        this.updatePagination();
    }
    
    sortData() {
        switch(this.currentSort) {
            case 'name':
                this.filteredData.sort((a, b) => a.hostname.localeCompare(b.hostname));
                break;
            case 'cpu-high':
                this.filteredData.sort((a, b) => b.cpu_usage - a.cpu_usage);
                break;
            case 'cpu-low':
                this.filteredData.sort((a, b) => a.cpu_usage - b.cpu_usage);
                break;
            case 'memory-high':
                this.filteredData.sort((a, b) => b.memory_usage_percent - a.memory_usage_percent);
                break;
            case 'memory-low':
                this.filteredData.sort((a, b) => a.memory_usage_percent - b.memory_usage_percent);
                break;
            case 'disk-high':
                this.filteredData.sort((a, b) => b.disk[0].disk_usage_percent - a.disk[0].disk_usage_percent);
                break;
            case 'disk-low':
                this.filteredData.sort((a, b) => a.disk[0].disk_usage_percent - b.disk[0].disk_usage_percent);
                break;
            case 'status-critical':
                this.filteredData.sort((a, b) => {
                    const statusA = this.getServerStatus(a);
                    const statusB = this.getServerStatus(b);
                    const statusWeight = { 'critical': 3, 'warning': 2, 'normal': 1 };
                    return statusWeight[statusB] - statusWeight[statusA];
                });
                break;
        }
    }
    
    updateServerGrid() {
        this.serverGrid.innerHTML = '';
        
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = Math.min(startIndex + this.itemsPerPage, this.filteredData.length);
        
        if (this.filteredData.length === 0) {
            this.serverGrid.innerHTML = `
                <div class="alert alert-info">
                    <i class="bi bi-info-circle"></i>
                    검색 조건에 맞는 서버가 없습니다.
                </div>
            `;
            return;
        }
        
        for (let i = startIndex; i < endIndex; i++) {
            const server = this.filteredData[i];
            const serverCard = this.createServerCard(server);
            this.serverGrid.appendChild(serverCard);
        }
    }
    
    updatePagination() {
        this.pagination.innerHTML = '';
        
        const totalPages = Math.ceil(this.filteredData.length / this.itemsPerPage);
        
        // 페이지네이션이 필요 없는 경우
        if (totalPages <= 1) {
            this.pagination.style.display = 'none';
            return;
        }
        
        this.pagination.style.display = 'flex';
        
        // 이전 페이지 버튼
        if (this.currentPage > 1) {
            const prevBtn = document.createElement('div');
            prevBtn.className = 'page-btn';
            prevBtn.innerHTML = '&laquo;';
            prevBtn.addEventListener('click', () => {
                this.currentPage--;
                this.updateServerGrid();
                this.updatePagination();
            });
            this.pagination.appendChild(prevBtn);
        }
        
        // 페이지 버튼 생성
        const maxButtons = 5; // 최대 표시할 페이지 버튼 수
        let startPage = Math.max(1, this.currentPage - Math.floor(maxButtons / 2));
        let endPage = Math.min(totalPages, startPage + maxButtons - 1);
        
        if (endPage - startPage + 1 < maxButtons && startPage > 1) {
            startPage = Math.max(1, endPage - maxButtons + 1);
        }
        
        for (let i = startPage; i <= endPage; i++) {
            const pageBtn = document.createElement('div');
            pageBtn.className = 'page-btn' + (i === this.currentPage ? ' active' : '');
            pageBtn.textContent = i;
            pageBtn.addEventListener('click', () => {
                this.currentPage = i;
                this.updateServerGrid();
                this.updatePagination();
            });
            this.pagination.appendChild(pageBtn);
        }
        
        // 다음 페이지 버튼
        if (this.currentPage < totalPages) {
            const nextBtn = document.createElement('div');
            nextBtn.className = 'page-btn';
            nextBtn.innerHTML = '&raquo;';
            nextBtn.addEventListener('click', () => {
                this.currentPage++;
                this.updateServerGrid();
                this.updatePagination();
            });
            this.pagination.appendChild(nextBtn);
        }
    }
    
    createServerCard(server) {
        const status = this.getServerStatus(server);
        const hasStoppedServices = Object.values(server.services).includes('stopped');
        const hasErrors = server.errors.length > 0;
        
        // 서버 카드 생성
        const serverCard = document.createElement('div');
        serverCard.className = 'server-card';
        serverCard.dataset.serverId = server.hostname;
        
        // 카드 클릭 시 상세 정보 모달 표시
        serverCard.addEventListener('click', () => this.showServerDetail(server));
        
        // 카드 내용 구성
        serverCard.innerHTML = `
            <div class="server-header">
                <div class="server-name">${server.hostname}</div>
                <div class="server-status status-${status}">${this.getStatusLabel(status)}</div>
            </div>
            <div class="server-details">
                <div class="detail-item">
                    <div class="detail-label">CPU 사용량</div>
                    <div class="detail-value">${server.cpu_usage}%</div>
                    <div class="progress-bar-container">
                        <div class="progress-bar progress-${this.getResourceStatus(server.cpu_usage)}" 
                             style="width: ${server.cpu_usage}%"></div>
                    </div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">메모리</div>
                    <div class="detail-value">${server.memory_usage_percent.toFixed(1)}%</div>
                    <div class="progress-bar-container">
                        <div class="progress-bar progress-${this.getResourceStatus(server.memory_usage_percent)}" 
                             style="width: ${server.memory_usage_percent}%"></div>
                    </div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">디스크 (${server.disk[0].mount})</div>
                    <div class="detail-value">${server.disk[0].disk_usage_percent.toFixed(1)}%</div>
                    <div class="progress-bar-container">
                        <div class="progress-bar progress-${this.getResourceStatus(server.disk[0].disk_usage_percent)}" 
                             style="width: ${server.disk[0].disk_usage_percent}%"></div>
                    </div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">로드 평균</div>
                    <div class="detail-value">${server.load_avg_1m}</div>
                </div>
            </div>
            <div class="services-list">
                ${Object.entries(server.services).map(([name, status]) => `
                    <div class="service-badge service-${status}">${name} (${status})</div>
                `).join('')}
            </div>
            ${hasErrors ? `
                <div class="error-messages">
                    ${server.errors.length > 0 ? `<i class="bi bi-exclamation-triangle-fill"></i> ${server.errors.length}개의 오류` : ''}
                </div>
            ` : ''}
        `;
        
        return serverCard;
    }
    
    showServerDetail(server) {
        const modalBody = document.getElementById('modal-body');
        const modalTitle = document.getElementById('modal-server-name');
        const status = this.getServerStatus(server);
        
        // 서버 이름과 상태
        modalTitle.innerHTML = `
            ${server.hostname} 
            <span class="server-status status-${status}">${this.getStatusLabel(status)}</span>
        `;
        
        // 모달 내용 구성
        modalBody.innerHTML = `
            <div class="detail-section">
                <div class="detail-title">시스템 정보</div>
                <table class="table table-sm">
                    <tr>
                        <td>OS</td>
                        <td>${server.os}</td>
                    </tr>
                    <tr>
                        <td>가동 시간</td>
                        <td>${server.uptime}</td>
                    </tr>
                    <tr>
                        <td>프로세스 수</td>
                        <td>${server.process_count}</td>
                    </tr>
                    <tr>
                        <td>좀비 프로세스</td>
                        <td>${server.zombie_count}</td>
                    </tr>
                    <tr>
                        <td>로드 평균 (1분)</td>
                        <td>${server.load_avg_1m}</td>
                    </tr>
                    <tr>
                        <td>마지막 업데이트</td>
                        <td>${new Date(server.timestamp).toLocaleString()}</td>
                    </tr>
                </table>
            </div>
            
            <div class="detail-section">
                <div class="detail-title">리소스 현황</div>
                <div class="chart-container resource-chart">
                    <canvas id="resource-chart"></canvas>
                </div>
            </div>
            
            <div class="detail-section">
                <div class="detail-title">네트워크 정보</div>
                <table class="table table-sm">
                    <tr>
                        <td>인터페이스</td>
                        <td>${server.net.interface}</td>
                    </tr>
                    <tr>
                        <td>수신 바이트</td>
                        <td>${this.formatBytes(server.net.rx_bytes)}</td>
                    </tr>
                    <tr>
                        <td>송신 바이트</td>
                        <td>${this.formatBytes(server.net.tx_bytes)}</td>
                    </tr>
                    <tr>
                        <td>수신 오류</td>
                        <td>${server.net.rx_errors}</td>
                    </tr>
                    <tr>
                        <td>송신 오류</td>
                        <td>${server.net.tx_errors}</td>
                    </tr>
                </table>
            </div>
            
            <div class="detail-section">
                <div class="detail-title">서비스 상태</div>
                <div class="services-list">
                    ${Object.entries(server.services).map(([name, status]) => `
                        <div class="service-badge service-${status}">${name} (${status})</div>
                    `).join('')}
                </div>
            </div>
            
            <div class="detail-section">
                <div class="detail-title">에러 메시지</div>
                ${server.errors.length > 0 ? `
                    <ul class="list-group">
                        ${server.errors.map(error => `
                            <li class="list-group-item text-danger">${error}</li>
                        `).join('')}
                    </ul>
                ` : `<p>현재 보고된 오류가 없습니다.</p>`}
            </div>
            
            <div class="detail-section">
                <div class="detail-title">24시간 리소스 사용 추이</div>
                <div class="history-chart-container">
                    <canvas id="history-chart"></canvas>
                </div>
            </div>
        `;
        
        // 모달 표시
        this.modalElement.style.display = 'block';
        
        // 서버 리소스 차트 생성
        this.createResourceChart(server);
        
        // 이력 데이터 차트 생성 (있는 경우)
        if (window.serverHistoricalData && window.serverHistoricalData[server.hostname]) {
            this.createHistoryChart(server.hostname);
        }
    }
    
    closeModal() {
        this.modalElement.style.display = 'none';
    }
    
    createResourceChart(server) {
        const ctx = document.getElementById('resource-chart').getContext('2d');
        
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['CPU', '메모리', '디스크'],
                datasets: [{
                    label: '사용량 (%)',
                    data: [
                        server.cpu_usage, 
                        server.memory_usage_percent, 
                        server.disk[0].disk_usage_percent
                    ],
                    backgroundColor: [
                        this.getChartColor(server.cpu_usage),
                        this.getChartColor(server.memory_usage_percent),
                        this.getChartColor(server.disk[0].disk_usage_percent)
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100
                    }
                }
            }
        });
    }
    
    createHistoryChart(hostname) {
        const historicalData = window.serverHistoricalData[hostname];
        if (!historicalData || historicalData.length === 0) return;
        
        const ctx = document.getElementById('history-chart').getContext('2d');
        
        // 시간 레이블 생성 (최근 24시간)
        const labels = historicalData.map(data => {
            const date = new Date(data.timestamp);
            return `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
        });
        
        // CPU, 메모리, 디스크 데이터 추출
        const cpuData = historicalData.map(data => data.cpu_usage);
        const memoryData = historicalData.map(data => data.memory_usage_percent);
        const diskData = historicalData.map(data => data.disk[0].disk_usage_percent);
        
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'CPU',
                        data: cpuData,
                        borderColor: 'rgba(255, 99, 132, 1)',
                        backgroundColor: 'rgba(255, 99, 132, 0.2)',
                        borderWidth: 2,
                        tension: 0.1
                    },
                    {
                        label: '메모리',
                        data: memoryData,
                        borderColor: 'rgba(54, 162, 235, 1)',
                        backgroundColor: 'rgba(54, 162, 235, 0.2)',
                        borderWidth: 2,
                        tension: 0.1
                    },
                    {
                        label: '디스크',
                        data: diskData,
                        borderColor: 'rgba(75, 192, 192, 1)',
                        backgroundColor: 'rgba(75, 192, 192, 0.2)',
                        borderWidth: 2,
                        tension: 0.1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        title: {
                            display: true,
                            text: '사용량 (%)'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: '시간'
                        }
                    }
                }
            }
        });
    }
    
    updateProblemsList() {
        if (!this.aiProcessor) return;
        
        const problemsList = document.getElementById('problem-list');
        const problems = this.aiProcessor.detectProblems();
        
        problemsList.innerHTML = '';
        
        if (problems.length === 0) {
            problemsList.innerHTML = '<div class="alert alert-success">현재 감지된 문제가 없습니다.</div>';
            return;
        }
        
        problems.forEach(problem => {
            const problemItem = document.createElement('li');
            problemItem.className = `problem-item ${problem.severity === 'Critical' ? 'critical-problem' : ''}`;
            problemItem.innerHTML = `
                <div class="problem-severity">${problem.severity}</div>
                <div class="problem-description">${problem.description}</div>
                <div class="problem-solution"><strong>제안 해결책:</strong> ${problem.solution}</div>
            `;
            problemsList.appendChild(problemItem);
        });
    }
    
    processAIQuery() {
        if (!this.aiProcessor) return;
        
        const queryInput = document.getElementById('ai-query-input');
        const query = queryInput.value.trim();
        
        if (!query) return;
        
        const responseElement = document.querySelector('.ai-response');
        const responseContent = document.querySelector('.ai-response-content');
        
        // 응답 영역 보이기
        responseElement.style.display = 'block';
        responseContent.innerHTML = '<div class="loading-spinner"></div> 분석 중...';
        
        // AI 질의 처리
        this.aiProcessor.processQuery(query)
            .then(response => {
                responseContent.innerHTML = response;
            })
            .catch(error => {
                responseContent.innerHTML = `오류가 발생했습니다: ${error.message}`;
            });
    }
    
    downloadErrorReport() {
        if (!this.aiProcessor) return;
        
        const report = this.aiProcessor.generateErrorReport();
        const blob = new Blob([report], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `server_error_report_${new Date().toISOString().slice(0, 10)}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    // 유틸리티 함수
    getServerStatus(server) {
        // 요구사항에 맞게 수정된 상태 판단 로직
        // 실제 자원 사용률(CPU, 메모리, 디스크)과 오류 정보를 함께 고려
        
        // 심각 상태 조건 (하나 이상의 항목이 90% 이상 또는 오류가 있는 경우)
        if (server.cpu_usage >= this.thresholds.critical.cpu ||
            server.memory_usage_percent >= this.thresholds.critical.memory ||
            server.disk[0].disk_usage_percent >= this.thresholds.critical.disk ||
            (server.errors && server.errors.length > 0)) {
            return 'critical';
        }
        
        // 경고 상태 조건 (하나 이상의 항목이 70% 이상 90% 미만)
        if (server.cpu_usage >= this.thresholds.warning.cpu ||
            server.memory_usage_percent >= this.thresholds.warning.memory ||
            server.disk[0].disk_usage_percent >= this.thresholds.warning.disk) {
            return 'warning';
        }
        
        // 그 외는 정상 (모든 항목이 70% 미만)
        return 'normal';
    }
    
    getResourceStatus(value, type = 'generic') {
        // 리소스 유형에 따른 임계값 적용
        const criticalThreshold = type in this.thresholds.critical 
            ? this.thresholds.critical[type] 
            : this.thresholds.critical.cpu;
        
        const warningThreshold = type in this.thresholds.warning 
            ? this.thresholds.warning[type] 
            : this.thresholds.warning.cpu;
        
        if (value >= criticalThreshold) return 'critical';
        if (value >= warningThreshold) return 'warning';
        return 'normal';
    }
    
    getStatusLabel(status) {
        switch(status) {
            case 'normal': return '정상';
            case 'warning': return '경고';
            case 'critical': return '심각';
            default: return '알 수 없음';
        }
    }
    
    getChartColor(value, type = 'generic') {
        const status = this.getResourceStatus(value, type);
        switch(status) {
            case 'critical': return 'rgba(220, 53, 69, 0.7)'; // 심각
            case 'warning': return 'rgba(253, 154, 20, 0.7)'; // 경고
            default: return 'rgba(40, 167, 69, 0.7)'; // 정상
        }
    }
    
    formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
        
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }
}

// 데이터 프로세서 인스턴스 생성
window.addEventListener('DOMContentLoaded', () => {
    window.dataProcessor = new DataProcessor();
});
