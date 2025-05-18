/**
 * OpenManager AI - 데이터 처리기
 * 서버 데이터 처리, 페이지네이션, 필터링 및 UI 업데이트 로직을 구현합니다.
 */

class DataProcessor {
    constructor() {
        try {
            // 기본 데이터 초기화
            this.serverData = window.serverData || [];
            this.filteredData = [];
            this.currentFilter = 'all';
            this.currentSort = 'name';
            this.searchQuery = '';
            this.currentPage = 1;
            this.itemsPerPage = 6; // 페이지당 서버 수
            
            // AI 문제 페이지네이션
            this.currentProblemPage = 1;
            this.problemsPerPage = 5; // 페이지당, 처음에 표시될 문제 수
            
            // 초기화 로깅
            console.log('DataProcessor 초기화 시작...');
            
            // AIProcessor 인스턴스 초기화 개선
            if (window.aiProcessor) {
                this.aiProcessor = window.aiProcessor;
                console.log('기존 AIProcessor 인스턴스를 사용합니다.');
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
            
            // UI 요소 참조 - 안전하게 참조를 시도합니다
            this.findUIElements();
            
            // 이벤트 리스너 등록
            if (this.hasRequiredElements()) {
                this.registerEventListeners();
                console.log('이벤트 리스너가 등록되었습니다.');
            } else {
                console.warn('일부 UI 요소를 찾을 수 없어 이벤트 리스너 등록이 제한됩니다.');
            }
            
            // 자동 데이터 업데이트 (1분 간격)
            setInterval(() => this.refreshData(), 60 * 1000);
            
            // 초기 데이터 로드
            this.loadData();
            
            // 서버 상태 판단 통합 로직을 전역 함수로 등록
            window.getServerStatus = (server) => this.getServerStatus(server);
            
            console.log('DataProcessor 초기화 완료.');
        } catch (error) {
            console.error('DataProcessor 초기화 중 심각한 오류 발생:', error);
            
            // 최소한의 기능 보장
            this.serverData = window.serverData || [];
            this.filteredData = window.serverData || [];
            
            // 기본 필수 함수들은 최소한으로라도 구현
            if (!this.showLoading) {
                this.showLoading = function() {
                    const loadingIndicator = document.getElementById('loadingIndicator');
                    const serverGrid = document.getElementById('serverGrid');
                    if (loadingIndicator) loadingIndicator.style.display = 'block';
                    if (serverGrid) serverGrid.style.opacity = '0.3';
                };
            }
            
            if (!this.hideLoading) {
                this.hideLoading = function() {
                    const loadingIndicator = document.getElementById('loadingIndicator');
                    const serverGrid = document.getElementById('serverGrid');
                    if (loadingIndicator) loadingIndicator.style.display = 'none';
                    if (serverGrid) serverGrid.style.opacity = '1';
                };
            }
            
            // 기본 데이터 처리 함수
            if (!this.handleDataUpdate) {
                this.handleDataUpdate = function(data) {
                    this.serverData = data || [];
                    this.filteredData = data || [];
                    this.renderServerGrid();
                    this.hideLoading();
                };
            }
        }
    }
    
    // UI 요소를 찾아 참조를 저장하는 메소드
    findUIElements() {
        try {
            // UI 요소 참조
            this.serverGrid = document.getElementById('serverGrid');
            this.loadingIndicator = document.getElementById('loadingIndicator');
            this.searchInput = document.getElementById('searchInput');
            this.statusFilter = document.getElementById('statusFilter');
            this.pageSize = document.getElementById('pageSize');
            this.prevPageBtn = document.getElementById('prevPageBtn');
            this.nextPageBtn = document.getElementById('nextPageBtn');
            this.serverCount = document.getElementById('serverCount');
            this.currentPageElement = document.getElementById('currentPage');
            this.refreshButton = document.getElementById('refreshBtn');
            this.modalElement = document.getElementById('serverDetailModal');
            this.closeModalButton = document.querySelector('.btn-close[data-bs-dismiss="modal"]');
            
            // 페이지네이션 컨테이너 요소
            this.pagination = document.querySelector('.pagination-container');
            
            // 모든 요소 참조가 필요하지 않는지 확인 로깅
            const missingElements = [];
            if (!this.serverGrid) missingElements.push('serverGrid');
            if (!this.loadingIndicator) missingElements.push('loadingIndicator');
            if (!this.refreshButton) missingElements.push('refreshBtn');
            
            if (missingElements.length > 0) {
                console.warn(`다음 UI 요소를 찾을 수 없습니다: ${missingElements.join(', ')}`);
            }
        } catch (error) {
            console.error('UI 요소 참조 중 오류:', error);
        }
    }
    
    // 필수 UI 요소가 있는지 확인
    hasRequiredElements() {
        // 최소한 서버 그리드와 로딩 인디케이터는 필요
        return this.serverGrid && this.loadingIndicator;
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
        
        // 전체 문제 보기 버튼 이벤트 처리
        const viewAllProblemsBtn = document.getElementById('viewAllProblemsBtn');
        if (viewAllProblemsBtn) {
            viewAllProblemsBtn.addEventListener('click', () => {
                // 현재 모든 문제를 모달로 표시하도록 수정
                this.showAllProblems();
            });
        }
        
        // 프리셋 태그 버튼 이벤트
        document.querySelectorAll('.preset-tag').forEach(tag => {
            tag.addEventListener('click', () => {
                // 이전에 선택된 태그의 active 클래스 제거
                document.querySelectorAll('.preset-tag.active').forEach(el => {
                    el.classList.remove('active');
                });
                
                // 클릭한 태그에 active 클래스 추가
                tag.classList.add('active');
                
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
                
                // 0.5초 후 active 클래스 제거하여 클릭 효과 리셋
                setTimeout(() => {
                    tag.classList.remove('active');
                }, 500);
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
        const maxAttempts = 20; // 10초 = 500ms * 20
        const checkInterval = setInterval(() => {
            if (window.serverData && window.serverData.length > 0) {
                clearInterval(checkInterval);
                this.handleDataUpdate(window.serverData);
                return;
            }
            
            attempts++;
            if (attempts >= maxAttempts) {
                clearInterval(checkInterval);
                this.hideLoading();
                console.error('서버 데이터를 로드하지 못했습니다. 백업 데이터 생성을 시도합니다.');
                this.createBackupData();
            }
        }, 500);
    }
    
    // 백업 데이터 생성 함수
    createBackupData() {
        console.log('백업 데이터 생성 시도...');
        
        try {
            // 1. generateDummyData 함수 검사 및 호출
            if (typeof generateDummyData === 'function') {
                window.serverData = generateDummyData(10); // 30개에서 10개로 줄임
                if (window.serverData && window.serverData.length > 0) {
                    this.handleDataUpdate(window.serverData);
                    return;
                }
            }
            
            // 2. generateDummyData가 없거나 실패한 경우 직접 더미 데이터 생성
            console.log('기본 더미 데이터 생성...');
            const backupServers = [];
            
            // 기본 더미 서버 10대 생성
            for (let i = 1; i <= 10; i++) {
                // 약 30%의 확률로 문제 있는 서버 생성
                const hasProblem = Math.random() < 0.3;
                const problemLevel = hasProblem ? (Math.random() < 0.3 ? 'critical' : 'warning') : 'normal';
                
                const cpuUsage = problemLevel === 'critical' ? 
                    Math.floor(Math.random() * 10) + 90 : // 90-99%
                    problemLevel === 'warning' ? 
                        Math.floor(Math.random() * 20) + 70 : // 70-89%
                        Math.floor(Math.random() * 50) + 10; // 10-59%
                
                const memoryUsage = problemLevel === 'critical' ? 
                    Math.floor(Math.random() * 10) + 90 : // 90-99%
                    problemLevel === 'warning' ? 
                        Math.floor(Math.random() * 20) + 70 : // 70-89%
                        Math.floor(Math.random() * 50) + 10; // 10-59%
                
                const diskUsage = problemLevel === 'critical' ? 
                    Math.floor(Math.random() * 10) + 90 : // 90-99%
                    problemLevel === 'warning' ? 
                        Math.floor(Math.random() * 20) + 70 : // 70-89%
                        Math.floor(Math.random() * 50) + 20; // 20-69%
                
                backupServers.push({
                    hostname: `server-${i}`,
                    os: 'Linux',
                    uptime: '3 days, 12:30:15',
                    cpu_usage: cpuUsage,
                    memory_usage_percent: memoryUsage,
                    memory_total: '16GB',
                    memory_used: '8GB',
                    disk: [{
                        mount: '/',
                        disk_total: '500GB',
                        disk_used: '300GB',
                        disk_usage_percent: diskUsage
                    }],
                    load_avg_1m: (Math.random() * 5).toFixed(2),
                    load_avg_5m: (Math.random() * 4).toFixed(2),
                    load_avg_15m: (Math.random() * 3).toFixed(2),
                    process_count: Math.floor(Math.random() * 200) + 50,
                    zombie_count: Math.floor(Math.random() * 3),
                    timestamp: new Date().toISOString(),
                    net: {
                        interface: 'eth0',
                        rx_bytes: Math.floor(Math.random() * 1000000),
                        tx_bytes: Math.floor(Math.random() * 1000000),
                        rx_errors: Math.floor(Math.random() * 10),
                        tx_errors: Math.floor(Math.random() * 10)
                    },
                    services: {
                        'nginx': problemLevel === 'critical' ? 'stopped' : 'running',
                        'mysql': Math.random() > 0.9 ? 'stopped' : 'running',
                        'redis': Math.random() > 0.9 ? 'stopped' : 'running'
                    },
                    errors: problemLevel !== 'normal' ? 
                        [problemLevel === 'critical' ? 'Critical: 서버 응답 없음' : '경고: 높은 부하 감지'] : []
                });
            }
            
            // 전역 변수에 저장 및 이벤트 발생
            window.serverData = backupServers;
            this.handleDataUpdate(backupServers);
            
            // 이벤트 발생시키기
            const event = new CustomEvent('serverDataUpdated', { 
                detail: backupServers 
            });
            window.dispatchEvent(event);
            
        } catch (error) {
            console.error('백업 데이터 생성 중 오류:', error);
            
            // 최종 실패 시 오류 메시지 표시
            this.serverGrid.innerHTML = `
                <div class="alert alert-danger">
                    <i class="bi bi-exclamation-triangle"></i>
                    서버 데이터를 로드하지 못했습니다. 새로고침 버튼을 클릭하여 다시 시도해 주세요.
                </div>
            `;
        }
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
        
        // 새로고침 버튼 상태 업데이트
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.classList.add('loading');
            refreshBtn.setAttribute('disabled', 'disabled');
            const refreshContent = refreshBtn.querySelector('.refresh-content');
            const loadingContent = refreshBtn.querySelector('.loading-content');
            
            if (refreshContent) refreshContent.style.display = 'none';
            if (loadingContent) loadingContent.style.display = 'inline-block';
        }
        
        // 페이지 재로드가 아닌 데이터만 새로 생성
        if (typeof generateDummyData === 'function') {
            try {
                console.log('더미 데이터 다시 생성...');
                window.serverData = generateDummyData(10); // 30개에서 10개로 줄임
                
                // 데이터 업데이트 이벤트 발생시키기
                const event = new CustomEvent('serverDataUpdated', { 
                    detail: window.serverData 
                });
                window.dispatchEvent(event);
                
                // 3초 후 로딩 숨기기 (새로고침 효과)
                setTimeout(() => {
                    this.hideLoading();
                    
                    // 새로고침 버튼 상태 복원
                    this.resetRefreshButton(refreshBtn);
                }, 3000);
                
                return;
            } catch (e) {
                console.error('데이터 새로고침 중 오류:', e);
                // 오류 발생 시 원래 데이터로 UI 복원
                this.hideLoading();
                this.resetRefreshButton(refreshBtn);
                
                // 오류 메시지 표시
                const errorAlert = document.createElement('div');
                errorAlert.className = 'alert alert-danger alert-dismissible fade show';
                errorAlert.innerHTML = `
                    <strong>오류 발생!</strong> 데이터를 새로고침하는 중 문제가 발생했습니다.
                    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
                `;
                
                // 서버 그리드 위에 오류 메시지 삽입
                const parent = this.serverGrid.parentNode;
                parent.insertBefore(errorAlert, this.serverGrid);
                
                // 5초 후 자동으로 오류 메시지 제거
                setTimeout(() => {
                    if (errorAlert.parentNode) {
                        errorAlert.parentNode.removeChild(errorAlert);
                    }
                }, 5000);
                
                return;
            }
        }
        
        // 데이터가 업데이트되면 serverDataUpdated 이벤트로 처리됨
        // 하지만 10초 내에 업데이트가 없으면 현재 데이터로 UI 다시 로드
        setTimeout(() => {
            if (this.loadingIndicator.style.display !== 'none') {
                this.hideLoading();
                this.applyFiltersAndSort();
                
                // 새로고침 버튼 상태 복원
                this.resetRefreshButton(refreshBtn);
            }
        }, 10000);
    }
    
    // 새로고침 버튼 상태 초기화 유틸리티 메소드
    resetRefreshButton(refreshBtn) {
        if (refreshBtn) {
            refreshBtn.classList.remove('loading');
            refreshBtn.removeAttribute('disabled');
            const refreshContent = refreshBtn.querySelector('.refresh-content');
            const loadingContent = refreshBtn.querySelector('.loading-content');
            
            if (refreshContent) refreshContent.style.display = 'inline-block';
            if (loadingContent) loadingContent.style.display = 'none';
        }
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
        try {
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
            
            // UI 업데이트를 별도 메소드로 분리하여 안전하게 실행
            this.updateUI();
        } catch (error) {
            console.error('필터 및 정렬 적용 중 오류:', error);
            
            // 오류 발생 시 기본 처리
            this.filteredData = [...this.serverData];
            
            // 최소한의 UI 업데이트 시도
            this.hideLoading();
            this.safeUpdateServerGrid();
        }
    }
    
    // 안전하게 UI 요소들을 업데이트하는 메소드
    updateUI() {
        try {
            // 서버 그리드 업데이트
            this.updateServerGrid();
        } catch (e) {
            console.error('서버 그리드 업데이트 중 오류:', e);
            this.safeUpdateServerGrid();
        }
        
        try {
            // 페이지네이션 업데이트
            this.updateNumericPagination();
        } catch (e) {
            console.error('페이지네이션 업데이트 중 오류:', e);
        }
        
        try {
            // 서버 카운트 업데이트
            this.updateServerCount();
        } catch (e) {
            console.error('서버 카운트 업데이트 중 오류:', e);
        }
    }
    
    // 최소한의 안전한 서버 그리드 업데이트
    safeUpdateServerGrid() {
        if (!this.serverGrid) return;
        
        try {
            this.serverGrid.innerHTML = '';
            
            if (this.filteredData.length === 0) {
                this.serverGrid.innerHTML = `
                    <div class="alert alert-info">
                        <i class="bi bi-info-circle"></i>
                        검색 조건에 맞는 서버가 없습니다.
                    </div>
                `;
                return;
            }
            
            // 가장 기본적인 서버 목록만 표시
            const startIndex = (this.currentPage - 1) * this.itemsPerPage;
            const endIndex = Math.min(startIndex + this.itemsPerPage, this.filteredData.length);
            
            for (let i = startIndex; i < endIndex; i++) {
                const server = this.filteredData[i];
                if (!server) continue;
                
                const div = document.createElement('div');
                div.className = 'server-card';
                div.textContent = server.hostname || 'Unknown Server';
                this.serverGrid.appendChild(div);
            }
        } catch (e) {
            console.error('안전한 서버 그리드 업데이트 중 오류:', e);
            this.serverGrid.innerHTML = '<div class="alert alert-danger">서버 데이터 표시 중 오류가 발생했습니다.</div>';
        }
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
        
        // 현재 페이지 사이즈 설정 사용 (더 이상 고정 값 사용 안 함)
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
        
        // 페이지네이션 업데이트
        this.updateNumericPagination();
    }
    
    updateNumericPagination() {
        const paginationContainer = document.querySelector('.pagination-container');
        if (!paginationContainer) return;
        
        paginationContainer.innerHTML = '';
        
        const totalPages = Math.ceil(this.filteredData.length / this.itemsPerPage);
        
        // 이전 페이지 버튼
        const prevBtn = document.createElement('button');
        prevBtn.className = 'btn btn-sm btn-outline-secondary';
        prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
        prevBtn.disabled = this.currentPage === 1;
        prevBtn.addEventListener('click', () => {
            if (this.currentPage > 1) {
                this.currentPage--;
                this.updateServerGrid();
            }
        });
        paginationContainer.appendChild(prevBtn);
        
        // 페이지 번호 버튼
        const maxVisiblePages = 5;
        let startPage = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
        
        // 표시할 페이지 버튼이 최대 개수보다 적을 경우 startPage 조정
        if (endPage - startPage + 1 < maxVisiblePages && startPage > 1) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }
        
        // 첫 페이지로 이동 버튼 (필요 시)
        if (startPage > 1) {
            const firstPageBtn = document.createElement('button');
            firstPageBtn.className = 'btn btn-sm btn-outline-secondary mx-1';
            firstPageBtn.textContent = '1';
            firstPageBtn.addEventListener('click', () => {
                this.currentPage = 1;
                this.updateServerGrid();
            });
            paginationContainer.appendChild(firstPageBtn);
            
            // 생략 표시 (첫 페이지 버튼과 현재 범위 사이)
            if (startPage > 2) {
                const ellipsis = document.createElement('span');
                ellipsis.className = 'mx-1';
                ellipsis.textContent = '...';
                paginationContainer.appendChild(ellipsis);
            }
        }
        
        // 페이지 버튼 생성
        for (let i = startPage; i <= endPage; i++) {
            const pageBtn = document.createElement('button');
            pageBtn.className = `btn btn-sm mx-1 ${i === this.currentPage ? 'btn-primary' : 'btn-outline-secondary'}`;
            pageBtn.textContent = i.toString();
            pageBtn.addEventListener('click', () => {
                this.currentPage = i;
                this.updateServerGrid();
            });
            paginationContainer.appendChild(pageBtn);
        }
        
        // 마지막 페이지로 이동 버튼 (필요 시)
        if (endPage < totalPages) {
            // 생략 표시 (현재 범위와 마지막 페이지 버튼 사이)
            if (endPage < totalPages - 1) {
                const ellipsis = document.createElement('span');
                ellipsis.className = 'mx-1';
                ellipsis.textContent = '...';
                paginationContainer.appendChild(ellipsis);
            }
            
            const lastPageBtn = document.createElement('button');
            lastPageBtn.className = 'btn btn-sm btn-outline-secondary mx-1';
            lastPageBtn.textContent = totalPages.toString();
            lastPageBtn.addEventListener('click', () => {
                this.currentPage = totalPages;
                this.updateServerGrid();
            });
            paginationContainer.appendChild(lastPageBtn);
        }
        
        // 다음 페이지 버튼
        const nextBtn = document.createElement('button');
        nextBtn.className = 'btn btn-sm btn-outline-secondary';
        nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
        nextBtn.disabled = this.currentPage === totalPages;
        nextBtn.addEventListener('click', () => {
            if (this.currentPage < totalPages) {
                this.currentPage++;
                this.updateServerGrid();
            }
        });
        paginationContainer.appendChild(nextBtn);
        
        // 현재 페이지 정보 업데이트
        if (this.currentPageElement) {
            this.currentPageElement.style.display = 'none'; // 기존 페이지 표시 숨김
        }
    }
    
    createServerCard(server) {
        if (!server) {
            console.error("서버 데이터가 없습니다.");
            return document.createElement('div'); // 빈 요소 반환
        }
        
        const status = this.getServerStatus(server);
        // 안전하게 services 체크
        const hasStoppedServices = server.services && Object.values(server.services).some(status => status === 'stopped');
        // 안전하게 errors 체크
        const hasErrors = server.errors && Array.isArray(server.errors) && server.errors.length > 0;
        
        // 서버 카드 생성
        const serverCard = document.createElement('div');
        serverCard.className = 'server-card status-' + status;
        serverCard.dataset.serverId = server.hostname || 'unknown';
        
        // 카드 클릭 시 상세 정보 모달 표시
        serverCard.addEventListener('click', () => this.showServerDetail(server));
        serverCard.style.cursor = 'pointer'; // 클릭 가능함을 시각적으로 표시
        
        // CPU, 메모리, 디스크 사용률을 안전하게 가져오기
        const cpuUsage = server.cpu_usage || 0;
        const memoryUsage = server.memory_usage_percent || 0;
        const diskUsage = server.disk && server.disk[0] ? server.disk[0].disk_usage_percent || 0 : 0;
        const diskMount = server.disk && server.disk[0] ? server.disk[0].mount || '/' : '/';
        
        // 카드 내용 구성
        serverCard.innerHTML = `
            <div class="server-header">
                <div class="server-name">${server.hostname || 'Unknown Server'}</div>
                <div class="server-status status-${status}">${this.getStatusLabel(status)}</div>
            </div>
            <div class="server-details">
                <div class="detail-item">
                    <div class="detail-label">CPU 사용량</div>
                    <div class="detail-value">${cpuUsage}%</div>
                    <div class="progress-bar-container">
                        <div class="progress-bar progress-${this.getResourceStatus(cpuUsage)}" 
                             style="width: ${cpuUsage}%"></div>
                    </div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">메모리</div>
                    <div class="detail-value">${typeof memoryUsage === 'number' ? memoryUsage.toFixed(1) : '0'}%</div>
                    <div class="progress-bar-container">
                        <div class="progress-bar progress-${this.getResourceStatus(memoryUsage)}" 
                             style="width: ${memoryUsage}%"></div>
                    </div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">디스크 (${diskMount})</div>
                    <div class="detail-value">${typeof diskUsage === 'number' ? diskUsage.toFixed(1) : '0'}%</div>
                    <div class="progress-bar-container">
                        <div class="progress-bar progress-${this.getResourceStatus(diskUsage)}" 
                             style="width: ${diskUsage}%"></div>
                    </div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">로드 평균</div>
                    <div class="detail-value">${server.load_avg_1m || '0'}</div>
                </div>
            </div>
            <div class="services-list">
                ${server.services ? Object.entries(server.services).map(([name, status]) => `
                    <div class="service-badge service-${status}">${name} (${status})</div>
                `).join('') : '<div class="service-badge">서비스 정보 없음</div>'}
            </div>
            ${hasErrors ? `
                <div class="error-messages">
                    <i class="bi bi-exclamation-triangle-fill"></i> ${server.errors.length}개의 오류
                </div>
            ` : ''}
        `;
        
        return serverCard;
    }
    
    showServerDetail(server) {
        // 부트스트랩 모달 요소 및 내용을 찾기
        const modalElement = document.getElementById('serverDetailModal');
        if (!modalElement) {
            console.error("모달 요소(serverDetailModal)를 찾을 수 없습니다.");
            return;
        }
        
        // 모달 헤더 내에서 제목 요소 찾기
        const modalTitle = modalElement.querySelector('.modal-title');
        if (!modalTitle) {
            console.error("모달 제목 요소를 찾을 수 없습니다.");
            return;
        }
        
        // 모달 내용을 표시할 요소 찾기
        const modalBody = modalElement.querySelector('.modal-body');
        if (!modalBody) {
            console.error("모달 내용 요소를 찾을 수 없습니다.");
            return;
        }
        
        // 서버 상태 정보
        const status = this.getServerStatus(server);
        
        // 서버 이름과 상태 설정
        modalTitle.innerHTML = `
            ${server.hostname} 
            <span class="server-status status-${status}">${this.getStatusLabel(status)}</span>
        `;
        
        // 모달 내용 업데이트 - 개별 필드 업데이트 방식으로 변경
        // OS 정보
        const modalOS = document.getElementById('modalOS');
        if (modalOS) modalOS.textContent = server.os || '-';
        
        // 가동 시간
        const modalUptime = document.getElementById('modalUptime');
        if (modalUptime) modalUptime.textContent = server.uptime || '-';
        
        // 프로세스 수
        const modalProcessCount = document.getElementById('modalProcessCount');
        if (modalProcessCount) modalProcessCount.textContent = server.process_count || '-';
        
        // 좀비 프로세스
        const modalZombieCount = document.getElementById('modalZombieCount');
        if (modalZombieCount) modalZombieCount.textContent = server.zombie_count || '-';
        
        // 로드 평균
        const modalLoadAvg = document.getElementById('modalLoadAvg');
        if (modalLoadAvg) modalLoadAvg.textContent = server.load_avg_1m || '-';
        
        // 마지막 업데이트
        const modalLastUpdate = document.getElementById('modalLastUpdate');
        if (modalLastUpdate) modalLastUpdate.textContent = new Date(server.timestamp).toLocaleString() || '-';
        
        // 네트워크 정보
        const modalNetInterface = document.getElementById('modalNetInterface');
        if (modalNetInterface) modalNetInterface.textContent = server.net?.interface || '-';
        
        const modalRxBytes = document.getElementById('modalRxBytes');
        if (modalRxBytes) modalRxBytes.textContent = this.formatBytes(server.net?.rx_bytes) || '-';
        
        const modalTxBytes = document.getElementById('modalTxBytes');
        if (modalTxBytes) modalTxBytes.textContent = this.formatBytes(server.net?.tx_bytes) || '-';
        
        const modalRxErrors = document.getElementById('modalRxErrors');
        if (modalRxErrors) modalRxErrors.textContent = server.net?.rx_errors || '-';
        
        const modalTxErrors = document.getElementById('modalTxErrors');
        if (modalTxErrors) modalTxErrors.textContent = server.net?.tx_errors || '-';
        
        // 서비스 상태
        const modalServiceStatus = document.getElementById('modalServiceStatus');
        if (modalServiceStatus) {
            modalServiceStatus.innerHTML = '';
            
            if (server.services && Object.keys(server.services).length > 0) {
                Object.entries(server.services).forEach(([name, status]) => {
                    const serviceTag = document.createElement('div');
                    serviceTag.className = `service-status-tag service-${status}`;
                    serviceTag.innerHTML = `
                        ${name} 
                        <span class="status-indicator">
                            <i class="fas fa-${status === 'running' ? 'check-circle' : 'times-circle'}"></i>
                        </span>
                    `;
                    modalServiceStatus.appendChild(serviceTag);
                });
            } else {
                modalServiceStatus.innerHTML = '<div class="alert alert-info">서비스 정보가 없습니다.</div>';
            }
        }
        
        // 오류 메시지
        const modalErrorsContainer = document.getElementById('modalErrorsContainer');
        if (modalErrorsContainer) {
            if (server.errors && server.errors.length > 0) {
                modalErrorsContainer.innerHTML = `
                    <div class="alert alert-danger">
                        <ul class="mb-0">
                            ${server.errors.map(error => `<li>${error}</li>`).join('')}
                        </ul>
                    </div>
                `;
            } else {
                modalErrorsContainer.innerHTML = '<div class="alert alert-info">현재 보고된 오류가 없습니다.</div>';
            }
        }
        
        // 모달 표시 (부트스트랩 5 방식)
        const modal = new bootstrap.Modal(modalElement);
        modal.show();
        
        // 리소스 차트 생성
        this.createResourceChart(server);
        
        // 서버 이름을 서버 이름 요소에 설정
        const modalServerName = document.getElementById('modalServerName');
        if (modalServerName) modalServerName.textContent = `${server.hostname} 상세 정보`;
    }
    
    closeModal() {
        this.modalElement.style.display = 'none';
    }
    
    createResourceChart(server) {
        const chartElement = document.getElementById('resourceBarChart');
        if (!chartElement) {
            console.error("리소스 차트 요소(resourceBarChart)를 찾을 수 없습니다.");
            return;
        }
        
        const ctx = chartElement.getContext('2d');
        if (!ctx) {
            console.error("리소스 차트 컨텍스트를 가져올 수 없습니다.");
            return;
        }
        
        // 기존 차트가 있다면 파괴
        if (this.resourceChartInstance) {
            this.resourceChartInstance.destroy();
        }
        
        this.resourceChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['CPU', '메모리', '디스크'],
                datasets: [{
                    label: '사용량 (%)',
                    data: [
                        server.cpu_usage || 0, 
                        server.memory_usage_percent || 0, 
                        (server.disk && server.disk.length > 0) ? server.disk[0].disk_usage_percent || 0 : 0
                    ],
                    backgroundColor: [
                        this.getChartColor(server.cpu_usage || 0),
                        this.getChartColor(server.memory_usage_percent || 0),
                        this.getChartColor((server.disk && server.disk.length > 0) ? server.disk[0].disk_usage_percent || 0 : 0)
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
        const paginationContainer = document.querySelector('.problem-pagination');

        if (!problemListContainer || !loadingIndicator || !emptyIndicator) {
            console.error("AI Problem list UI elements not found.");
            return;
        }

        loadingIndicator.style.display = 'block';
        emptyIndicator.style.display = 'none';
        problemListContainer.innerHTML = '';
        if (paginationContainer) paginationContainer.innerHTML = '';

        try {
            // detectProblems 메소드가 존재하고 호출 가능한지 확인
            let problems = [];
            if (typeof this.aiProcessor.detectProblems === 'function') {
                problems = this.aiProcessor.detectProblems();
            } else {
                console.warn("AI 프로세서에 detectProblems 메소드가 없습니다. 기본 문제 감지 로직을 사용합니다.");
                // 기본 문제 감지 로직: 리소스 사용량이 높은 서버 감지
                problems = this.serverData.filter(server => {
                    const status = this.getServerStatus(server);
                    if (status === 'critical') {
                        return {
                            severity: 'Critical',
                            serverHostname: server.hostname,
                            description: `리소스 과부하 감지`,
                            solution: '서버 자원 확인 및 불필요한 프로세스를 종료하세요.'
                        };
                    } else if (status === 'warning') {
                        return {
                            severity: 'Warning',
                            serverHostname: server.hostname,
                            description: `자원 사용량 높음`,
                            solution: '서버 상태를 모니터링하고 추세를 확인하세요.'
                        };
                    }
                    return null;
                }).filter(p => p !== null);
            }
            
            // 결과가 배열이 아니거나 undefined인 경우 빈 배열로 처리
            if (!Array.isArray(problems)) {
                console.warn("detectProblems() 함수가 배열을 반환하지 않았습니다.");
                problems = [];
            }
            
            // Normal 상태는 제외 (detectProblems에서 이미 처리되었거나, 여기서 한번 더 필터링)
            problems = problems.filter(p => p && (p.severity === 'Critical' || p.severity === 'Warning' || p.severity === 'Error'));
    
            // 정렬: Critical 우선, 그 다음 Warning(Error 포함) (내림차순)
            problems.sort((a, b) => {
                const severityScore = (severity) => {
                    if (severity === 'Critical') return 2;
                    if (severity === 'Warning' || severity === 'Error') return 1;
                    return 0; // 그 외 (정상 등, 실제로는 필터링됨)
                };
                return severityScore(b.severity) - severityScore(a.severity);
            });
    
            loadingIndicator.style.display = 'none';
        
            if (problems.length === 0) {
                emptyIndicator.style.display = 'block';
                return;
            }

            // 전체 문제 데이터 저장
            this.problemsData = problems;
            
            // 페이지네이션 계산
            const totalProblems = problems.length;
            const totalPages = Math.ceil(totalProblems / this.problemsPerPage);
            
            // 현재 페이지가 범위를 벗어나면 조정
            if (this.currentProblemPage > totalPages) {
                this.currentProblemPage = totalPages;
            }
            
            // 현재 페이지에 표시할 문제 계산
            const startIdx = (this.currentProblemPage - 1) * this.problemsPerPage;
            const endIdx = Math.min(startIdx + this.problemsPerPage, totalProblems);
            const currentPageProblems = problems.slice(startIdx, endIdx);
            
            // 문제 항목 렌더링
            currentPageProblems.forEach(problem => {
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
                
                // 문제 항목 클릭 시 액션 (서버 상세 모달)
                listItem.addEventListener('click', () => {
                    const server = this.serverData.find(s => s.hostname === problem.serverHostname);
                    if (server) this.showServerDetail(server);
                });
                
                problemListContainer.appendChild(listItem);
            });
            
            // 페이지네이션 생성
            if (paginationContainer && totalPages > 1) {
                // 이전 페이지 버튼
                const prevBtn = document.createElement('button');
                prevBtn.className = 'btn btn-sm btn-outline-secondary';
                prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
                prevBtn.disabled = this.currentProblemPage === 1;
                prevBtn.addEventListener('click', () => {
                    if (this.currentProblemPage > 1) {
                        this.currentProblemPage--;
                        this.updateProblemsList();
                    }
                });
                paginationContainer.appendChild(prevBtn);
                
                // 페이지 번호 버튼
                const maxVisiblePages = 5;
                let startPage = Math.max(1, this.currentProblemPage - Math.floor(maxVisiblePages / 2));
                let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
                
                // 표시할 페이지 버튼 조정
                if (endPage - startPage + 1 < maxVisiblePages && startPage > 1) {
                    startPage = Math.max(1, endPage - maxVisiblePages + 1);
                }
                
                // 페이지 버튼 생성
                for (let i = startPage; i <= endPage; i++) {
                    const pageBtn = document.createElement('button');
                    pageBtn.className = `btn btn-sm mx-1 ${i === this.currentProblemPage ? 'btn-primary' : 'btn-outline-secondary'}`;
                    pageBtn.textContent = i.toString();
                    pageBtn.addEventListener('click', () => {
                        this.currentProblemPage = i;
                        this.updateProblemsList();
                    });
                    paginationContainer.appendChild(pageBtn);
                }
                
                // 다음 페이지 버튼
                const nextBtn = document.createElement('button');
                nextBtn.className = 'btn btn-sm btn-outline-secondary';
                nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
                nextBtn.disabled = this.currentProblemPage === totalPages;
                nextBtn.addEventListener('click', () => {
                    if (this.currentProblemPage < totalPages) {
                        this.currentProblemPage++;
                        this.updateProblemsList();
                    }
                });
                paginationContainer.appendChild(nextBtn);
            }
        } catch (error) {
            console.error("AI 문제 목록 업데이트 중 오류 발생:", error);
            loadingIndicator.style.display = 'none';
            emptyIndicator.textContent = "문제 목록을 불러오는 중 오류가 발생했습니다.";
            emptyIndicator.style.display = 'block';
        }
    }
    
    // 서버 수 표시 업데이트하는 메소드
    updateServerCount() {
        if (!this.serverCount) return;
        
        try {
            const endIndex = Math.min(this.currentPage * this.itemsPerPage, this.filteredData.length);
            const startIndex = this.filteredData.length > 0 ? (this.currentPage - 1) * this.itemsPerPage + 1 : 0;
            
            if (this.filteredData.length > 0) {
                this.serverCount.textContent = `전체 ${this.serverData.length} 서버 중 ${startIndex}-${endIndex} 표시 중`;
            } else {
                this.serverCount.textContent = `전체 ${this.serverData.length} 서버 중 0 표시 중`;
            }
        } catch (e) {
            console.error("서버 카운트 업데이트 중 오류:", e);
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

        // 타임스탬프 업데이트
        const timestampElement = document.getElementById('timestamp');
        if (timestampElement) {
            const latestTimestamp = this.serverData.reduce((latest, server) => {
                const serverTime = new Date(server.timestamp).getTime();
                return serverTime > latest ? serverTime : latest;
            }, 0);
            
            if (latestTimestamp > 0) {
                timestampElement.textContent = `데이터 기준 시각: ${new Date(latestTimestamp).toLocaleString()}`;
            } else {
                timestampElement.textContent = `데이터 기준 시각: ${new Date().toLocaleString()}`;
            }
        }

        summaryContainer.innerHTML = `
            <div class="row mb-3">
                <div class="col-4 text-center">
                    <h3 class="mb-0 display-6 text-success">${normalCount}</h3>
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
        
        // 상태 알림 생성 및 표시
        this.updateStatusAlert(normalCount, warningCount, criticalCount);

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
        
        if (normalCount === 0 && warningCount === 0 && criticalCount === 0) {
            // 데이터가 없는 경우 빈 차트가 아닌 메시지 표시
            chartElement.parentElement.innerHTML = `
                <div class="alert alert-info text-center">
                    <i class="fas fa-info-circle me-2"></i>
                    표시할 서버 상태 데이터가 없습니다.
                </div>
            `;
            return;
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
        
        // 서버 수 표시 업데이트
        this.updateServerCount();
    }
    
    // 서버 상태 요약 알림 업데이트
    updateStatusAlert(normalCount, warningCount, criticalCount) {
        const alertElement = document.getElementById('statusSummaryAlert');
        if (!alertElement) return;
        
        const iconContainer = alertElement.querySelector('.status-icon');
        const messageContainer = alertElement.querySelector('.status-message');
        
        if (!iconContainer || !messageContainer) return;
        
        const totalServers = normalCount + warningCount + criticalCount;
        
        // 상태 결정 (최악의 상태를 기준으로)
        let status = 'normal';
        if (criticalCount > 0) status = 'critical';
        else if (warningCount > 0) status = 'warning';
        
        // 알림 클래스와 아이콘 설정
        let alertClass, iconHTML, message;
        
        switch(status) {
            case 'critical':
                alertClass = 'alert-danger';
                iconHTML = '<i class="fas fa-exclamation-circle fa-2x"></i>';
                
                if (criticalCount === 1) {
                    message = `<strong>긴급 주의 필요:</strong> 1개 서버가 심각한 상태입니다. 즉시 확인이 필요합니다.`;
                } else {
                    message = `<strong>긴급 주의 필요:</strong> ${criticalCount}개 서버가 심각한 상태입니다. 즉시 확인이 필요합니다.`;
                }
                break;
                
            case 'warning':
                alertClass = 'alert-warning';
                iconHTML = '<i class="fas fa-exclamation-triangle fa-2x"></i>';
                
                if (warningCount === 1) {
                    message = `<strong>주의:</strong> 1개 서버에 경고 상태가 감지되었습니다. 상태를 확인해 주세요.`;
                } else {
                    message = `<strong>주의:</strong> ${warningCount}개 서버에 경고 상태가 감지되었습니다. 상태를 확인해 주세요.`;
                }
                break;
                
            default: // normal
                alertClass = 'alert-success';
                iconHTML = '<i class="fas fa-check-circle fa-2x"></i>';
                message = `<strong>모두 정상:</strong> 현재 ${totalServers}개의 서버가 모두 정상 작동 중입니다.`;
        }
        
        // 알림 업데이트
        alertElement.className = `alert d-flex align-items-center ${alertClass}`;
        iconContainer.innerHTML = iconHTML;
        messageContainer.innerHTML = message;
        
        // 애니메이션 효과로 표시
        alertElement.style.display = 'flex';
        alertElement.style.opacity = '0';
        alertElement.style.transform = 'translateY(-10px)';
        
        // 부드럽게 표시
        setTimeout(() => {
            alertElement.style.transition = 'all 0.5s ease';
            alertElement.style.opacity = '1';
            alertElement.style.transform = 'translateY(0)';
        }, 100);
    }
    
    // 프리셋 쿼리 처리 개선
    processPresetQuery(query) {
        if (!this.aiProcessor) return;
        
        // 정상 상태 서버 목록 표시 처리
        if (query.includes("정상 작동 중인 서버 목록")) {
            const normalServers = this.serverData.filter(server => this.getServerStatus(server) === 'normal');
            
            if (normalServers.length === 0) {
                return "현재 정상 작동 중인 서버가 없습니다. 모든 서버에 문제가 있습니다.";
            }
            
            // 정상 서버 목록 생성
            let response = `## 정상 작동 중인 서버 목록 (총 ${normalServers.length}대)\n\n`;
            
            normalServers.forEach(server => {
                response += `### ${server.hostname}\n`;
                response += `- CPU: ${server.cpu_usage}% (정상)\n`;
                response += `- 메모리: ${server.memory_usage_percent}% (정상)\n`;
                response += `- 디스크: ${server.disk[0].disk_usage_percent}% (정상)\n`;
                response += `- 업타임: ${server.uptime}\n\n`;
            });
            
            response += "모든 서버가 정상적으로 작동 중입니다. 현재 별도의 조치가 필요하지 않습니다.";
            
            return response;
        }
        
        // 기존 AI 프로세서 호출
        return this.aiProcessor.processQuery(query);
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
        
        // 먼저 프리셋 쿼리 처리 시도
        if (query.includes("정상 작동 중인 서버 목록")) {
            const result = this.processPresetQuery(query);
            if (result) {
                if (queryResultElement) {
                    queryResultElement.innerHTML = result;
                    queryResultElement.classList.add('active');
                    queryResultElement.style.display = 'block';
                }
                if (queryLoadingElement) queryLoadingElement.classList.remove('active');
                return;
            }
        }
        
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
        
        let report = '';
        
        try {
            // generateErrorReport 메소드가 존재하고 호출 가능한지 확인
            if (typeof this.aiProcessor.generateErrorReport === 'function') {
                report = this.aiProcessor.generateErrorReport();
            } else {
                console.warn("AI 프로세서에 generateErrorReport 메소드가 없습니다. 기본 보고서를 생성합니다.");
                
                // 기본 장애 보고서 생성 로직
                report = '# 서버 상태 보고서\n\n';
                report += `생성 시간: ${new Date().toLocaleString()}\n\n`;
                
                // 서버 상태에 따라 요약 정보 생성
                const criticalServers = this.serverData.filter(s => this.getServerStatus(s) === 'critical');
                const warningServers = this.serverData.filter(s => this.getServerStatus(s) === 'warning');
                const normalServers = this.serverData.filter(s => this.getServerStatus(s) === 'normal');
                
                report += `## 서버 상태 요약\n\n`;
                report += `- 총 서버 수: ${this.serverData.length}\n`;
                report += `- 정상: ${normalServers.length}\n`;
                report += `- 경고: ${warningServers.length}\n`;
                report += `- 심각: ${criticalServers.length}\n\n`;
                
                // 문제 상태의 서버에 대한 세부 정보
                if (criticalServers.length > 0) {
                    report += '## 심각한 상태의 서버\n\n';
                    criticalServers.forEach(server => {
                        report += `### ${server.hostname}\n`;
                        report += `- CPU: ${server.cpu_usage}%\n`;
                        report += `- 메모리: ${server.memory_usage_percent}%\n`;
                        report += `- 디스크: ${server.disk[0].disk_usage_percent}%\n`;
                        if (server.errors && server.errors.length > 0) {
                            report += `- 오류: ${server.errors.join(', ')}\n`;
                        }
                        report += `\n`;
                    });
                }
                
                if (warningServers.length > 0) {
                    report += '## 경고 상태의 서버\n\n';
                    warningServers.forEach(server => {
                        report += `### ${server.hostname}\n`;
                        report += `- CPU: ${server.cpu_usage}%\n`;
                        report += `- 메모리: ${server.memory_usage_percent}%\n`;
                        report += `- 디스크: ${server.disk[0].disk_usage_percent}%\n`;
                        if (server.errors && server.errors.length > 0) {
                            report += `- 오류: ${server.errors.join(', ')}\n`;
                        }
                        report += `\n`;
                    });
                }
            }
        } catch (e) {
            console.error("장애 보고서 생성 중 오류 발생:", e);
            report = '# 오류 발생\n\n장애 보고서를 생성하는 중 오류가 발생했습니다.\n\n' + e.message;
        }
        
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

    // 모든 문제를 보여주는 모달 표시
    showAllProblems() {
        if (!this.aiProcessor) {
            alert('AI 프로세서가 초기화되지 않아 문제 목록을 가져올 수 없습니다.');
            return;
        }
        
        // 문제 데이터 가져오기
        let problems = [];
        try {
            if (typeof this.aiProcessor.detectProblems === 'function') {
                problems = this.aiProcessor.detectProblems();
            } else {
                console.warn("AI 프로세서에 detectProblems 메소드가 없습니다.");
                alert('문제 목록을 불러올 수 없습니다.');
                return;
            }
            
            // 결과가 배열이 아니거나 undefined인 경우 빈 배열로 처리
            if (!Array.isArray(problems)) {
                console.warn("detectProblems() 함수가 배열을 반환하지 않았습니다.");
                problems = [];
            }
            
            // Normal 상태는 제외
            problems = problems.filter(p => p && (p.severity === 'Critical' || p.severity === 'Warning' || p.severity === 'Error'));
            
            // 정렬: Critical 우선, 그 다음 Warning/Error
            problems.sort((a, b) => {
                const severityScore = (severity) => {
                    if (severity === 'Critical') return 2;
                    if (severity === 'Warning' || severity === 'Error') return 1;
                    return 0;
                };
                return severityScore(b.severity) - severityScore(a.severity);
            });
        } catch (error) {
            console.error("문제 목록 가져오기 오류:", error);
            alert('문제 목록을 불러오는 중 오류가 발생했습니다.');
            return;
        }
        
        // 문제가 없는 경우
        if (problems.length === 0) {
            alert('현재 감지된 문제가 없습니다.');
            return;
        }
        
        // 기존 모달이 있으면 제거
        const existingModal = document.getElementById('allProblemsModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // 모든 문제를 표시하는 모달 생성
        const modalHTML = `
            <div class="modal fade" id="allProblemsModal" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog modal-lg modal-dialog-scrollable">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="fas fa-exclamation-triangle me-2 text-danger"></i> 전체 서버 문제 목록
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <div class="problems-count mb-3">
                                총 <span class="fw-bold">${problems.length}</span>개의 문제가 감지되었습니다.
                            </div>
                            <ul class="list-group all-problems-list">
                                ${problems.map(problem => `
                                    <li class="list-group-item list-group-item-action problem-item severity-${problem.severity.toLowerCase()}">
                                        <div class="d-flex w-100 justify-content-between">
                                            <h6 class="mb-1 problem-description">${problem.description}</h6>
                                            <small class="text-muted">${problem.serverHostname || '알 수 없는 서버'}</small>
                                        </div>
                                        <p class="mb-1 problem-solution">${problem.solution || '제안된 해결책 없음'}</p>
                                        <small class="text-muted">심각도: <span class="fw-bold problem-severity-text">${problem.severity}</span></small>
                                    </li>
                                `).join('')}
                            </ul>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-primary" id="downloadModalReport">
                                <i class="bi bi-download"></i> 보고서 다운로드
                            </button>
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">닫기</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // 모달 추가 및 표시
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Bootstrap 모달 인스턴스 생성 및 표시
        const modalElement = document.getElementById('allProblemsModal');
        const modal = new bootstrap.Modal(modalElement);
        modal.show();
        
        // 문제 항목 클릭 이벤트 추가
        modalElement.querySelectorAll('.problem-item').forEach((item, index) => {
            item.addEventListener('click', () => {
                // 해당 서버 모달 표시
                const serverHostname = problems[index].serverHostname;
                if (!serverHostname) return;
                
                const server = this.serverData.find(s => s.hostname === serverHostname);
                if (server) {
                    modal.hide(); // 현재 모달 닫기
                    setTimeout(() => {
                        this.showServerDetail(server); // 서버 상세 모달 표시
                    }, 500);
                }
            });
        });
        
        // 보고서 다운로드 버튼 이벤트
        const downloadBtn = document.getElementById('downloadModalReport');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => {
                this.downloadErrorReport();
            });
        }
    }
}

// 데이터 프로세서 인스턴스 생성
window.addEventListener('DOMContentLoaded', () => {
    window.dataProcessor = new DataProcessor();
});
