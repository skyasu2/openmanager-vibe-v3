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
        
        // AIProcessor 인스턴스 초기화 개선
        if (window.aiProcessor) {
            this.aiProcessor = window.aiProcessor;
        } else if (typeof AIProcessor === 'function') {
            // AIProcessor 클래스가 존재하면 인스턴스 생성
            try {
                window.aiProcessor = new AIProcessor();
                this.aiProcessor = window.aiProcessor;
                console.log("AIProcessor 인스턴스를 새로 생성했습니다.");
            } catch (e) {
                console.error("AIProcessor 인스턴스 생성 중 오류 발생:", e);
                this.aiProcessor = null;
            }
        } else {
            console.warn("AIProcessor 클래스를 찾을 수 없습니다. 기본 상태 판단 로직을 사용합니다.");
            this.aiProcessor = null;
        }
        
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
        this.serverGrid = document.getElementById('serverGrid');
        this.loadingIndicator = document.getElementById('loadingIndicator');
        this.searchInput = document.getElementById('searchInput');
        this.statusFilter = document.getElementById('statusFilter');
        this.pageSize = document.getElementById('pageSize');
        this.prevPageBtn = document.getElementById('prevPageBtn');
        this.nextPageBtn = document.getElementById('nextPageBtn');
        this.serverCount = document.getElementById('serverCount');
        this.currentPage = document.getElementById('currentPage');
        this.refreshButton = document.getElementById('refreshBtn');
        this.modalElement = document.getElementById('serverDetailModal');
        this.closeModalButton = document.querySelector('.btn-close[data-bs-dismiss="modal"]');
        
        // 페이지네이션 컨테이너 요소 (HTML에 pagination 클래스나 ID를 가진 요소가 필요)
        this.pagination = document.querySelector('.pagination-container');
        
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
        // 필터링 이벤트
        if (this.statusFilter) {
            this.statusFilter.addEventListener('change', () => {
                this.currentFilter = this.statusFilter.value;
                this.currentPage = 1; // 필터 변경 시 첫 페이지로 리셋
                this.applyFiltersAndSort();
            });
        }
        
        // 검색 이벤트
        if (this.searchInput) {
            this.searchInput.addEventListener('input', () => {
                this.searchQuery = this.searchInput.value.toLowerCase();
                this.currentPage = 1; // 검색 시 첫 페이지로 리셋
                this.applyFiltersAndSort();
            });
        }
        
        // 페이지 크기 이벤트
        if (this.pageSize) {
            this.pageSize.addEventListener('change', () => {
                this.itemsPerPage = parseInt(this.pageSize.value);
                this.currentPage = 1;
                this.applyFiltersAndSort();
            });
        }
        
        // 이전 페이지 버튼
        if (this.prevPageBtn) {
            this.prevPageBtn.addEventListener('click', () => {
                if (this.currentPage > 1) {
                    this.currentPage--;
                    this.applyFiltersAndSort();
                }
            });
        }
        
        // 다음 페이지 버튼
        if (this.nextPageBtn) {
            this.nextPageBtn.addEventListener('click', () => {
                const totalPages = Math.ceil(this.filteredData.length / this.itemsPerPage);
                if (this.currentPage < totalPages) {
                    this.currentPage++;
                    this.applyFiltersAndSort();
                }
            });
        }
        
        // 새로고침 이벤트
        if (this.refreshButton) {
            this.refreshButton.addEventListener('click', () => this.refreshData());
        }
        
        // 모달 닫기 이벤트
        if (this.closeModalButton) {
            this.closeModalButton.addEventListener('click', () => this.closeModal());
        }
        
        // 서버 데이터 업데이트 이벤트 리스너
        window.addEventListener('serverDataUpdated', (event) => {
            this.handleDataUpdate(event.detail);
        });
        
        // 초기 AI 도우미 기능 설정
        const aiQuerySubmitButton = document.getElementById('ai-query-submit');
        if (aiQuerySubmitButton) {
            aiQuerySubmitButton.addEventListener('click', () => this.processAIQuery());
        }
        
        // 장애 보고서 다운로드 이벤트
        const downloadReportButton = document.getElementById('downloadAllReportsBtn');
        if (downloadReportButton) {
            downloadReportButton.addEventListener('click', () => this.downloadErrorReport());
        }
        
        // AI 자동 장애 보고서 '더 보기' 버튼 이벤트 - 페이지 로드 시 전역 리스너로 대체
        /*
        const toggleProblemListBtn = document.getElementById('toggleAiProblemListBtn');
        if (toggleProblemListBtn) {
            toggleProblemListBtn.addEventListener('click', function() {
                const list = document.getElementById('aiProblemList');
                if (!list) return;
                
                const btn = this;
                const expanded = btn.getAttribute('data-expanded') === 'true';

                if (expanded) {
                    // 목록 줄이기
                    [...list.children].forEach((item, index) => {
                        if (index >= 3) item.style.display = 'none';
                    });
                    btn.innerText = `더 보기 (${list.children.length - 3}개 더 있음)`;
                    btn.setAttribute('data-expanded', 'false');
                } else {
                    // 전체 펼치기
                    [...list.children].forEach(item => item.style.display = 'block');
                    btn.innerText = '접기';
                    btn.setAttribute('data-expanded', 'true');
                }
            });
        }
        */
        
        // 프리셋 태그 버튼 이벤트
        document.querySelectorAll('.preset-tag').forEach(tag => {
            tag.addEventListener('click', () => {
                const presetText = tag.dataset.preset;
                const input = document.getElementById('queryInput');
                if (input) {
                    input.value = presetText;
                    input.focus();
                    // 자동 실행
                    const submitButton = document.getElementById('ai-query-submit');
                    if (submitButton) {
                        submitButton.click();
                    }
                }
            });
        });
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
            this.updateProblemsList(); // AI 자동 장애 보고서 업데이트
        }
        
        // 필터 및 정렬 적용
        this.applyFiltersAndSort();
        this.updateGlobalStatusSummary(); // 서버 현황 요약 업데이트 추가
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
        if (!this.serverGrid) {
            console.error("서버 그리드 요소를 찾을 수 없습니다.");
            return;
        }
        
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
        // this.pagination 요소가 존재하지 않으면 함수 종료
        if (!this.pagination) {
            console.warn("Pagination element not found in the DOM");
            return;
        }
        
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
        
        // null 체크 추가 - modalTitle
        if (!modalTitle) {
            console.error("모달 제목 요소(modal-server-name)를 찾을 수 없습니다.");
            return;
        }
        
        // null 체크 추가 - modalBody
        if (!modalBody) {
            console.error("모달 본문 요소(modal-body)를 찾을 수 없습니다.");
            return;
        }
        
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
        
        // null 체크 추가 - modalElement
        if (!this.modalElement) {
            console.error("모달 요소를 찾을 수 없습니다.");
            return;
        }
        
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
        const chartElement = document.getElementById('resource-chart');
        if (!chartElement) {
            console.error("리소스 차트 요소(resource-chart)를 찾을 수 없습니다.");
            return;
        }
        
        const ctx = chartElement.getContext('2d');
        if (!ctx) {
            console.error("리소스 차트 컨텍스트를 가져올 수 없습니다.");
            return;
        }
        
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
        
        // history-chart-modal ID를 사용하도록 수정
        const canvasElement = document.getElementById('history-chart-modal');
        if (!canvasElement) {
            console.error("History chart canvas element not found in modal");
            return;
        }
        const ctx = canvasElement.getContext('2d');
        if (!ctx) {
            console.error("히스토리 차트 컨텍스트를 가져올 수 없습니다.");
            return;
        }
        
        // 기존 차트가 있다면 파괴
        if (this.historyChartInstance) {
            this.historyChartInstance.destroy();
        }

        // 시간 레이블 생성 (최근 24시간)
        const labels = historicalData.map(data => {
            const date = new Date(data.timestamp);
            return `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
        });
        
        // CPU, 메모리, 디스크 데이터 추출
        const cpuData = historicalData.map(data => data.cpu_usage);
        const memoryData = historicalData.map(data => data.memory_usage_percent);
        const diskData = historicalData.map(data => data.disk[0].disk_usage_percent);
        
        this.historyChartInstance = new Chart(ctx, {
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

        const problemListContainer = document.getElementById('aiProblemList');
        const loadingIndicator = document.getElementById('aiProblemsLoading');
        const emptyIndicator = document.getElementById('aiProblemsEmpty');
        const toggleButtonContainer = document.getElementById('aiProblemListToggle');
        const toggleButton = document.getElementById('toggleAiProblemListBtn');

        if (!problemListContainer || !loadingIndicator || !emptyIndicator || !toggleButtonContainer || !toggleButton) {
            console.error("AI Problem list UI elements not found.");
            return;
        }

        loadingIndicator.style.display = 'block';
        emptyIndicator.style.display = 'none';
        problemListContainer.innerHTML = '';
        toggleButtonContainer.style.display = 'none';

        // this.aiProcessor.detectProblems()는 severity가 'Critical', 'Error', 'Warning'인 문제만 반환한다고 가정
        let problems = this.aiProcessor.detectProblems(); 
        
        // Normal 상태는 제외 (detectProblems에서 이미 처리되었거나, 여기서 한번 더 필터링)
        problems = problems.filter(p => p.severity === 'Critical' || p.severity === 'Warning' || p.severity === 'Error');

        // 정렬: Warning(Error 포함) 우선, 그 다음 Critical (오름차순)
        // severity를 점수로 변환: Warning/Error = 1, Critical = 2
        problems.sort((a, b) => {
            const severityScore = (severity) => {
                if (severity === 'Critical') return 2;
                if (severity === 'Warning' || severity === 'Error') return 1;
                return 0; // 그 외 (정상 등, 실제로는 필터링됨)
            };
            return severityScore(a.severity) - severityScore(b.severity);
        });

        loadingIndicator.style.display = 'none';

        if (problems.length === 0) {
            emptyIndicator.style.display = 'block';
            problemListContainer.style.maxHeight = 'none'; // 내용 없을 시 maxHeight 제거
            return;
        }

        const maxInitialItems = 3;
        const maxExpandedItems = 10;
        let currentlyExpanded = toggleButton.dataset.expanded === 'true';

        const renderList = () => {
            problemListContainer.innerHTML = '';
            const itemsToShow = currentlyExpanded ? Math.min(problems.length, maxExpandedItems) : Math.min(problems.length, maxInitialItems);
            
            for (let i = 0; i < itemsToShow; i++) {
                const problem = problems[i];
                const listItem = document.createElement('li');
                listItem.className = `list-group-item list-group-item-action problem-item severity-${problem.severity.toLowerCase()}`;
                listItem.innerHTML = `
                    <div class="d-flex w-100 justify-content-between">
                        <h6 class="mb-1 problem-description">${problem.description}</h6>
                        <small class="text-muted">${problem.serverHostname || '알 수 없는 서버'}</small>
                    </div>
                    <p class="mb-1 problem-solution">${problem.solution || '제안된 해결책 없음'}</p>
                    <small class="text-muted">심각도: <span class="fw-bold problem-severity-text">${problem.severity}</span></small>
                `;
                // 서버 카드와 상태 일치: 서버 카드는 getServerStatus()를 통해 이미 aiProcessor의 판단을 따르므로 별도 조치 불필요.
                // 문제 항목 클릭 시 액션 (예: 서버 상세 모달)
                listItem.addEventListener('click', () => {
                    const server = this.serverData.find(s => s.hostname === problem.serverHostname);
                    if (server) this.showServerDetail(server);
                });
                problemListContainer.appendChild(listItem);
            }
            
            // 스크롤바 제어 (10개 이상일 때만 스크롤)
            if (problems.length > maxExpandedItems && currentlyExpanded) {
                 problemListContainer.style.maxHeight = '300px'; // 예시 높이, CSS로 조정 가능
                 problemListContainer.style.overflowY = 'auto';
            } else {
                 problemListContainer.style.maxHeight = 'none';
                 problemListContainer.style.overflowY = 'hidden';
            }
        };

        renderList();

        if (problems.length > maxInitialItems) {
            toggleButtonContainer.style.display = 'block';
            const remainingCount = problems.length - maxInitialItems;
            toggleButton.textContent = currentlyExpanded ? '접기' : `더 보기 (${Math.min(remainingCount, maxExpandedItems - maxInitialItems)}개 더 있음)`;
        } else {
            toggleButtonContainer.style.display = 'none';
        }

        // 더보기/접기 버튼 이벤트 리스너 (한 번만 등록)
        if (!this.aiProblemListToggleListenerAttached) {
            toggleButton.addEventListener('click', () => {
                currentlyExpanded = !currentlyExpanded;
                toggleButton.dataset.expanded = currentlyExpanded;
                renderList(); // 목록 다시 렌더링
                if (problems.length > maxInitialItems) {
                    const remainingCount = problems.length - maxInitialItems;
                    toggleButton.textContent = currentlyExpanded ? '접기' : `더 보기 (${Math.min(remainingCount, maxExpandedItems - maxInitialItems)}개 더 있음)`;
                }
            });
            this.aiProblemListToggleListenerAttached = true;
        }
    }
    
    updateGlobalStatusSummary() {
        if (!this.serverData || this.serverData.length === 0) return;

        const summaryContainer = document.getElementById('statusSummaryContainer');
        if (!summaryContainer) {
            console.error("Status summary container not found.");
            return;
        }

        let normalCount = 0;
        let warningCount = 0;
        let criticalCount = 0;

        this.serverData.forEach(server => {
            const status = this.getServerStatus(server); // 중앙 집중식 상태 판단 함수 사용
            if (status === 'normal') normalCount++;
            else if (status === 'warning') warningCount++;
            else if (status === 'critical') criticalCount++;
        });

        summaryContainer.innerHTML = `
            <div class="row mb-3">
                <div class="col-4 text-center">
                    <h3 class="mb-0 display-6">${normalCount}</h3>
                    <p class="text-success mb-0">정상</p>
                </div>
                <div class="col-4 text-center">
                    <h3 class="mb-0 display-6 text-warning">${warningCount}</h3>
                    <p class="text-warning mb-0">경고</p>
                </div>
                <div class="col-4 text-center">
                    <h3 class="mb-0 display-6 text-danger">${criticalCount}</h3>
                    <p class="text-danger mb-0">심각</p>
                </div>
            </div>
            <div>
                <canvas id="globalStatusChart" height="150"></canvas>
            </div>
        `;

        // 차트 업데이트
        const chartElement = document.getElementById('globalStatusChart');
        if (!chartElement) {
            console.error("Global status chart element not found.");
            return;
        }
        
        const chartCtx = chartElement.getContext('2d');
        if (!chartCtx) {
            console.error("Global status chart context could not be obtained.");
            return;
        }
        
        if (this.globalStatusChartInstance) {
            this.globalStatusChartInstance.destroy();
        }
        this.globalStatusChartInstance = new Chart(chartCtx, {
            type: 'doughnut',
            data: {
                labels: ['정상', '경고', '심각'],
                datasets: [{
                    data: [normalCount, warningCount, criticalCount],
                    backgroundColor: [
                        'rgba(40, 167, 69, 0.7)', // 정상 (초록 계열)
                        'rgba(253, 154, 20, 0.7)', // 경고 (주황 계열)
                        'rgba(220, 53, 69, 0.7)'  // 심각 (빨강 계열)
                    ],
                    borderColor: [
                        'rgba(40, 167, 69, 1)',
                        'rgba(253, 154, 20, 1)',
                        'rgba(220, 53, 69, 1)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed !== null) {
                                    label += context.parsed + ' 대';
                                }
                                return label;
                            }
                        }
                    }
                }
            }
        });
    }
    
    processAIQuery() {
        if (!this.aiProcessor) return;
        
        const queryInput = document.getElementById('queryInput');
        if (!queryInput) {
            console.error("쿼리 입력 요소(queryInput)를 찾을 수 없습니다.");
            return;
        }
        
        const query = queryInput.value.trim();
        if (!query) return;
        
        const queryLoadingElement = document.getElementById('queryLoading');
        const queryResultElement = document.getElementById('queryResult');
        
        // 응답 영역 보이기
        if (queryLoadingElement) queryLoadingElement.classList.add('active');
        if (queryResultElement) queryResultElement.style.display = 'none';
        
        // AI 질의 처리
        this.aiProcessor.processQuery(query)
            .then(response => {
                if (queryResultElement) {
                    queryResultElement.innerHTML = response;
                    queryResultElement.classList.add('active');
                    queryResultElement.style.display = 'block';
                }
            })
            .catch(error => {
                if (queryResultElement) {
                    queryResultElement.innerHTML = `오류가 발생했습니다: ${error.message}`;
                    queryResultElement.classList.add('active');
                    queryResultElement.style.display = 'block';
                }
            })
            .finally(() => {
                if (queryLoadingElement) queryLoadingElement.classList.remove('active');
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
        // AI Processor의 getEffectiveServerStatus를 사용하여 상태 결정
        if (this.aiProcessor && typeof this.aiProcessor.getEffectiveServerStatus === 'function') {
            try {
                return this.aiProcessor.getEffectiveServerStatus(server);
            } catch (e) {
                // 에러 발생 시 한 번만 경고 출력 (fallback 로직 수행)
                if (!this._hasLoggedAIProcessorError) {
                    console.error("Error calling aiProcessor.getEffectiveServerStatus:", e);
                    this._hasLoggedAIProcessorError = true;
                }
            }
        } else if (!this._hasLoggedNoAIProcessor) {
            // 경고 메시지를 한 번만 출력
            console.warn("AIProcessor 또는 getEffectiveServerStatus가 없어 기본 상태 판단 로직을 사용합니다.");
            this._hasLoggedNoAIProcessor = true;
        }
        
        // 폴백 로직 (AI Processor 사용 불가 또는 에러 시)
        // 리소스 사용률 기반 명확한 기준으로 상태 판단
        
        // 1. Critical 조건 판단
        if (server.cpu_usage >= this.thresholds.critical.cpu ||
            server.memory_usage_percent >= this.thresholds.critical.memory ||
            (server.disk && server.disk.length > 0 && server.disk[0].disk_usage_percent >= this.thresholds.critical.disk)) {
            return 'critical';
        }
        
        // 2. 오류 메시지 기반 Critical 판단
        const hasCriticalError = server.errors && server.errors.some(err => 
            typeof err === 'string' && err.toLowerCase().includes('critical'));
        if (hasCriticalError) {
            return 'critical';
        }
        
        // 3. 서비스 중단 기반 Critical 판단
        const hasStoppedService = server.services && Object.values(server.services).includes('stopped');
        if (hasStoppedService) {
            return 'critical';
        }
        
        // 4. Warning 조건 판단
        if (server.cpu_usage >= this.thresholds.warning.cpu ||
            server.memory_usage_percent >= this.thresholds.warning.memory ||
            (server.disk && server.disk.length > 0 && server.disk[0].disk_usage_percent >= this.thresholds.warning.disk)) {
            return 'warning';
        }
        
        // 5. 오류 메시지 기반 Warning 판단
        const hasWarningError = server.errors && server.errors.some(err => 
            typeof err === 'string' && (err.toLowerCase().includes('warning') || err.toLowerCase().includes('error')));
        if (hasWarningError) {
            return 'warning';
        }
        
        // 6. 위 조건에 해당하지 않으면 normal 상태
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
    
    // localStorage에서 각 패널의 상태(펼침/접힘)를 복원
    document.querySelectorAll('.collapsible-panel').forEach(panel => {
        const id = panel.id;
        if (!id) return; // id가 없는 패널은 건너뜀
        
        const state = localStorage.getItem(`panel_${id}_state`);
        const body = panel.querySelector('.collapsible-body');
        const icon = panel.querySelector('.collapse-toggle i');
        
        if (!body || !icon) return; // 필요한 요소가 없으면 건너뜀
        
        if (state === 'expanded') {
            // 패널을 펼침 상태로 설정
            body.classList.add('expanded');
            icon.classList.remove('fa-chevron-down');
            icon.classList.add('fa-chevron-up');
        } else if (state === 'collapsed') {
            // 패널을 접힘 상태로 설정
            body.classList.remove('expanded');
            icon.classList.remove('fa-chevron-up');
            icon.classList.add('fa-chevron-down');
        }
        // 저장된 상태가 없으면 기본 상태 유지
    });
    
    // '더 보기' 버튼 이벤트 리스너 직접 등록
    const toggleBtn = document.getElementById('toggleAiProblemListBtn');
    if (toggleBtn) {
        // 기존 이벤트 리스너 제거 (중복 방지)
        toggleBtn.removeEventListener('click', toggleAiProblemList);
        // 새 이벤트 리스너 등록
        toggleBtn.addEventListener('click', toggleAiProblemList);
    }
    
    // 토글 기능을 수행하는 함수 정의
    function toggleAiProblemList() {
        const list = document.getElementById('aiProblemList');
        if (!list) return;
        
        const btn = this;
        const isExpanded = btn.getAttribute('data-expanded') === 'true';

        if (isExpanded) {
            // 목록 줄이기
            [...list.children].forEach((item, index) => {
                if (index >= 3) item.style.display = 'none';
            });
            btn.textContent = `더 보기 (${list.children.length - 3}개 더 있음)`;
            btn.setAttribute('data-expanded', 'false');
        } else {
            // 전체 펼치기
            [...list.children].forEach(item => item.style.display = 'block');
            btn.textContent = '접기';
            btn.setAttribute('data-expanded', 'true');
        }
    }
});
