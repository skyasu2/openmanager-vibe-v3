/**
 * OpenManager AI - AI 질의 프로세서
 * 서버 모니터링 데이터를 분석하여 자연어 질의에 응답하고
 * 자동 문제 분석 및 해결 방법을 제공합니다.
 */

import { CONFIG } from './config.js';

export class AIProcessor {
    constructor() {
        this.serverData = null;
        this.historicalData = {};  // 10분 단위 데이터 저장
        this.maxHistoryPoints = 144;  // 24시간 (10분 단위)
        this.problemPatterns = this.initProblemPatterns();
        this.initializeData();
        this.setupDataListener();
        this.statusEmoji = {
            normal: '✅',
            warning: '⚠️',
            critical: '🔴'
        };
    }

    setupDataListener() {
        window.addEventListener('serverDataUpdated', (event) => {
            this.updateData(event.detail);
        });
    }

    async initializeData() {
        this.serverData = window.serverData || [];
        if (this.serverData.length > 0) {
            // 초기 데이터를 이력 데이터에 추가
            this.addDataToHistory(this.serverData);
        }
    }

    updateData(newData) {
        this.serverData = newData;
        // 새 데이터를 이력 데이터에 추가
        this.addDataToHistory(newData);
    }

    addDataToHistory(data) {
        const currentTimestamp = new Date().toISOString();
        
        // 각 서버별로 데이터 저장
        data.forEach(server => {
            const hostname = server.hostname;
            if (!this.historicalData[hostname]) {
                this.historicalData[hostname] = [];
            }
            
            // 새 데이터 포인트 추가
            this.historicalData[hostname].push({
                timestamp: currentTimestamp,
                cpu_usage: server.cpu_usage,
                memory_usage_percent: server.memory_usage_percent,
                disk_usage_percent: server.disk[0].disk_usage_percent,
                network_rx: server.net.rx_bytes,
                network_tx: server.net.tx_bytes,
                services: {...server.services},
                errors: [...(server.errors || [])],
                status: this.calculateServerStatus(server)
            });
            
            // 최대 데이터 포인트 수 유지
            if (this.historicalData[hostname].length > this.maxHistoryPoints) {
                this.historicalData[hostname].shift();
            }
        });
    }

    calculateServerStatus(server) {
        // CPU, 메모리, 디스크 사용률에 따른 서버 상태 결정
        // 이 함수는 이제 getEffectiveServerStatus로 대체될 수 있으나, 
        // 기존 historicalData 추가 로직 등에서 사용될 수 있으므로 유지하거나 점검 필요.
        
        // getEffectiveServerStatus 메서드가 존재하는지 확인하고 호출
        if (typeof this.getEffectiveServerStatus === 'function') {
            return this.getEffectiveServerStatus(server);
        }

        // Fallback or original simple logic if getEffectiveServerStatus is not yet defined or during setup
        if (server.cpu_usage >= 90 || 
            server.memory_usage_percent >= 90 || 
            (server.disk && server.disk.length > 0 && server.disk[0].disk_usage_percent >= 90)) {
            return 'critical';
        } else if (server.cpu_usage >= 70 || 
                  server.memory_usage_percent >= 70 || 
                  (server.disk && server.disk.length > 0 && server.disk[0].disk_usage_percent >= 70)) {
            return 'warning';
        } else {
            return 'normal';
        }
    }

    initProblemPatterns() {
        // 일반적인 서버 문제 패턴 정의
        // 순서 중요: Critical 패턴 우선, 그 다음 Warning 패턴
        return [
            // --- CRITICAL Patterns ---
            {
                id: 'critical_cpu',
                condition: server => server.cpu_usage >= 90,
                description: 'CPU 사용률이 90% 이상으로 매우 높음',
                severity: 'critical',
                causes: ['과도한 프로세스 실행', '백그라운드 작업 과부하', '리소스 집약적 애플리케이션', '악성 프로세스'],
                solutions: ['불필요한 프로세스 종료 (top, htop)', '애플리케이션 최적화', '서버 스케일업', '로드 밸런싱']
            },
            {
                id: 'critical_memory',
                condition: server => server.memory_usage_percent >= 90,
                description: '메모리 사용률이 90% 이상으로 매우 높음',
                severity: 'critical',
                causes: ['애플리케이션 메모리 누수', '캐시 설정 오류', '불필요한 서비스 과다 실행'],
                solutions: ['OOM 로그 분석 (dmesg)', '메모리 사용량 높은 프로세스 확인 (ps aux --sort=-%mem)', '애플리케이션 재시작/디버깅', 'swap 공간 확인/추가']
            },
            {
                id: 'critical_disk',
                condition: server => server.disk && server.disk.length > 0 && server.disk[0].disk_usage_percent >= 90,
                description: '주요 디스크 파티션 사용률 90% 이상',
                severity: 'critical',
                causes: ['로그 파일 누적', '임시 파일 미삭제', '데이터베이스 파일 급증', '백업 파일 과다'],
                solutions: ['대용량 파일/디렉토리 찾기 (ncdu, du)', '오래된 로그/임시파일 삭제', '로그 로테이션 설정', '디스크 확장/정리']
            },
            {
                id: 'service_down',
                condition: server => server.services && Object.values(server.services).includes('stopped'),
                description: '하나 이상의 주요 서비스가 중지됨',
                severity: 'critical',
                causes: ['서비스 충돌', '리소스 부족', '의존성 문제', '구성 오류'],
                solutions: ['서비스 로그 확인 (journalctl -u <service_name>)', '서비스 재시작 (systemctl restart <service_name>)', '의존성 패키지 확인/설치', '서비스 설정 파일 검토']
            },
            {
                id: 'critical_error_message',
                condition: server => server.errors && server.errors.some(err => typeof err === 'string' && err.toLowerCase().includes('critical')),
                description: '시스템 로그에 "Critical" 수준 오류 메시지 발생',
                severity: 'critical',
                causes: ['하드웨어 장애 임박', '커널 패닉', '중요 시스템 설정 오류'],
                solutions: ['즉시 시스템 로그 상세 분석 (journalctl, /var/log/syslog)', '하드웨어 진단', '전문가 지원 요청']
            },
            // --- WARNING Patterns (Critical 조건에 해당하지 않을 때 검사) ---
            {
                id: 'warning_cpu',
                condition: server => server.cpu_usage >= 70, // will only trigger if not >=90
                description: 'CPU 사용률이 70% 이상으로 경고 수준',
                severity: 'warning',
                causes: ['일시적 부하 증가', '최적화되지 않은 쿼리/작업', '리소스 부족 경계'],
                solutions: ['CPU 사용량 추이 모니터링', '최근 배포/변경 사항 확인', '자원 사용량 많은 프로세스 분석']
            },
            {
                id: 'warning_memory',
                condition: server => server.memory_usage_percent >= 70, // will only trigger if not >=90
                description: '메모리 사용률이 70% 이상으로 경고 수준',
                severity: 'warning',
                causes: ['캐시 사용량 증가', '장시간 실행된 애플리케이션', '가용 메모리 부족 임박'],
                solutions: ['메모리 사용 패턴 분석', '캐시 정책 검토', '불필요한 프로세스 정리 주기적 실행 고려']
            },
            {
                id: 'warning_disk',
                condition: server => server.disk && server.disk.length > 0 && server.disk[0].disk_usage_percent >= 70, // will only trigger if not >=90
                description: '주요 디스크 파티션 사용률 70% 이상',
                severity: 'warning',
                causes: ['데이터 증가 추세', '정리되지 않은 파일들', '디스크 공간 부족 예측'],
                solutions: ['정기적인 디스크 정리 스크립트 실행', '파일 시스템 점검', '사용량 알림 설정 강화']
            },
            {
                id: 'warning_error_message',
                condition: server => server.errors && 
                                   server.errors.some(err => typeof err === 'string' && (err.toLowerCase().includes('warning') || err.toLowerCase().includes('error'))),
                                // Critical 에러 메시지 패턴이 이미 위에서 Critical로 처리했을 것이므로, 여기서는 별도 중복 체크 안해도 됨.
                description: '"Warning" 또는 "Error" 수준의 오류 메시지 발생',
                severity: 'warning',
                causes: ['경미한 설정 오류', '예상된 예외 상황', '잠재적 문제 징후'],
                solutions: ['관련 로그 확인하여 원인 분석', '애플리케이션/시스템 설정 검토', '주기적인 시스템 상태 점검']
            },
            {
                id: 'network_errors',
                condition: server => server.net && (server.net.rx_errors > 50 || server.net.tx_errors > 50),
                description: '네트워크 수신/송신 오류 다수 발생',
                severity: 'warning',
                causes: ['네트워크 인터페이스 문제', '케이블/스위치 불량', '드라이버 이슈', '네트워크 혼잡'],
                solutions: ['네트워크 인터페이스 상태 확인 (ethtool, ip link)', '케이블 및 연결 점검', '네트워크 드라이버 업데이트/재설치', '네트워크 트래픽 분석']
            }
            // 기존 다른 패턴들도 필요에 따라 유지 또는 수정
        ];
    }

    getEffectiveServerStatus(server) {
        if (!server) return 'normal'; // server 객체가 없으면 기본 정상

        // Critical 패턴 검사
        for (const pattern of this.problemPatterns) {
            if (pattern.severity === 'critical' && pattern.condition(server)) {
                return 'critical';
            }
        }

        // Warning 패턴 검사
        for (const pattern of this.problemPatterns) {
            if (pattern.severity === 'warning' && pattern.condition(server)) {
                return 'warning';
            }
        }
        
        return 'normal'; // 위 모든 조건에 해당하지 않으면 정상
    }

    async processQuery(query) {
        if (!this.serverData || this.serverData.length === 0) {
            return '서버 데이터를 불러오는 중입니다. 잠시 후 다시 시도해주세요.';
        }

        // 쿼리 분석
        const analysis = this.analyzeQuery(query);
        
        // 결과 생성
        if (analysis.requestType === 'problem_analysis') {
            return this.generateProblemAnalysis();
        } else if (analysis.requestType === 'solution') {
            return this.generateSolutions(analysis.target);
        } else if (analysis.requestType === 'report') {
            return this.generateReportDownloadLink(analysis.reportType);
        } else {
            // 일반 질의 처리
            return this.generateDataResponse(analysis);
        }
    }

    analyzeQuery(query) {
        // 기본 분석 구조 정의
        const analysis = {
            requestType: 'general', // general, problem_analysis, solution, report
            target: null,
            metric: null,
            threshold: null,
            timeRange: 'current',
            serverType: null,
            reportType: null
        };

        // 소문자 변환 및 공백 표준화
        const normalizedQuery = query.toLowerCase().replace(/\s+/g, ' ');
        
        // 키워드별 매칭 사전 (확장성을 위해 키워드 목록을 분리)
        const keywordMappings = {
            // 메트릭 관련 키워드
            cpu: ['cpu', '씨피유', '시피유', '프로세서', 'processor', '연산', '처리'],
            memory: ['memory', 'ram', '메모리', '램', '기억장치'],
            disk: ['disk', '디스크', '저장', '저장소', '스토리지', 'storage', '하드', 'hdd', 'ssd'],
            network: ['network', '네트워크', '망', '인터넷', '연결', 'connection', '통신'],
            
            // 서버 타입 관련 키워드
            web: ['web', '웹', 'www', 'http'],
            db: ['db', 'database', '데이터베이스', 'sql', 'mysql', 'postgresql', 'oracle'],
            api: ['api', 'rest', 'graphql', 'endpoint'],
            app: ['app', 'application', '어플리케이션', '앱'],
            cache: ['cache', '캐시', 'redis', 'memcached'],
            
            // 시간 범위 관련 키워드
            recent: ['recent', '최근', '방금', '지금'],
            today: ['today', '오늘', '금일'],
            yesterday: ['yesterday', '어제'],
            week: ['week', '주간', '일주일'],
            month: ['month', '월간', '한달'],
            
            // 문제 유형 관련 키워드
            high_usage: ['high', 'usage', '사용량', '높음', '과도', '과부하'],
            low_space: ['low', 'space', '공간', '부족', '여유', '없음'],
            error: ['error', 'fail', '오류', '에러', '장애', '실패'],
            performance: ['performance', 'slow', '성능', '느림', '지연', '반응'],
            security: ['security', 'breach', '보안', '침해', '공격', '해킹'],
            
            // 상태 관련 키워드
            critical: ['critical', '심각', '위험', '긴급', '크리티컬'],
            warning: ['warning', '경고', '주의', '워닝'],
            normal: ['normal', '정상', '양호', '안정', '문제없음'],
            
            // 동작 관련 키워드
            check: ['check', 'status', '상태', '확인', '점검', '조회'],
            analyze: ['analyze', 'analysis', '분석', '진단', '평가'],
            fix: ['fix', 'solve', 'solution', '해결', '조치', '수정', '복구'],
            report: ['report', 'log', '보고서', '로그', '리포트', '기록'],
            list: ['list', 'show', 'display', '목록', '보여줘', '나열', '표시']
        };
        
        // 키워드 매칭 함수
        const matchesKeyword = (text, keywordType) => {
            if (!keywordMappings[keywordType]) return false;
            return keywordMappings[keywordType].some(keyword => text.includes(keyword));
        };
        
        // 매칭 우선순위가 있는 순서대로 조건 검사
        
        // 1. 문제 분석 요청 (이 검사가 가장 넓은 범위의 키워드를 포함하므로 우선 실행)
        if ((matchesKeyword(normalizedQuery, 'analyze') || 
             normalizedQuery.includes('문제') || 
             normalizedQuery.includes('이슈') || 
             normalizedQuery.includes('장애')) && 
            (matchesKeyword(normalizedQuery, 'check') || 
             matchesKeyword(normalizedQuery, 'analyze'))) {
            analysis.requestType = 'problem_analysis';
            return analysis;
        }
        
        // 2. 해결 방법 요청
        if (matchesKeyword(normalizedQuery, 'fix') || 
            normalizedQuery.includes('해결') || 
            normalizedQuery.includes('방법') || 
            normalizedQuery.includes('조치')) {
            analysis.requestType = 'solution';
            
            // 구체적인 문제 타입 식별
            if (matchesKeyword(normalizedQuery, 'cpu')) {
                analysis.target = 'cpu_high';
            } else if (matchesKeyword(normalizedQuery, 'memory')) {
                analysis.target = 'memory_high';
            } else if (matchesKeyword(normalizedQuery, 'disk')) {
                analysis.target = 'disk_full';
            } else if (normalizedQuery.includes('서비스') && (normalizedQuery.includes('중단') || normalizedQuery.includes('停止'))) {
                analysis.target = 'service_down';
            } else if (matchesKeyword(normalizedQuery, 'network')) {
                analysis.target = 'network_issue';
            } else if (matchesKeyword(normalizedQuery, 'error')) {
                analysis.target = 'general_error';
            }
            
            return analysis;
        }
        
        // 3. 보고서 요청
        if (matchesKeyword(normalizedQuery, 'report') || 
            normalizedQuery.includes('보고서') || 
            normalizedQuery.includes('리포트') || 
            normalizedQuery.includes('레포트') ||
            (matchesKeyword(normalizedQuery, 'list') && matchesKeyword(normalizedQuery, 'error'))) {
            analysis.requestType = 'report';
            
            // 보고서 유형 식별
            if (normalizedQuery.includes('일일') || normalizedQuery.includes('daily') || matchesKeyword(normalizedQuery, 'today')) {
                analysis.reportType = 'daily';
            } else if (normalizedQuery.includes('주간') || normalizedQuery.includes('weekly') || matchesKeyword(normalizedQuery, 'week')) {
                analysis.reportType = 'weekly';
            } else if (normalizedQuery.includes('월간') || normalizedQuery.includes('monthly') || matchesKeyword(normalizedQuery, 'month')) {
                analysis.reportType = 'monthly';
            } else if (normalizedQuery.includes('장애') || normalizedQuery.includes('incident')) {
                analysis.reportType = 'incident';
            } else {
                analysis.reportType = 'summary';
            }
            
            return analysis;
        }
        
        // 4. 메트릭별 일반 질의 처리
        
        // CPU 관련
        if (matchesKeyword(normalizedQuery, 'cpu')) {
            analysis.metric = 'cpu';
            
            // 임계값 검출 (숫자 + % 패턴 찾기)
            const thresholdMatch = normalizedQuery.match(/(\d+)(%|\s*퍼센트)/);
            if (thresholdMatch) {
                analysis.threshold = parseInt(thresholdMatch[1]);
            }
            
            // 서버 유형 검출
            for (const serverType of ['web', 'db', 'api', 'app', 'cache']) {
                if (matchesKeyword(normalizedQuery, serverType)) {
                    analysis.serverType = serverType;
                    break;
                }
            }
            
            // 시간 범위 검출
            for (const timeRange of ['recent', 'today', 'yesterday', 'week', 'month']) {
                if (matchesKeyword(normalizedQuery, timeRange)) {
                    analysis.timeRange = timeRange;
                    break;
                }
            }
            
            // 상태 필터 검출
            if (matchesKeyword(normalizedQuery, 'critical')) {
                analysis.target = 'critical';
            } else if (matchesKeyword(normalizedQuery, 'warning')) {
                analysis.target = 'warning';
            } else if (matchesKeyword(normalizedQuery, 'normal')) {
                analysis.target = 'normal';
            } else if (matchesKeyword(normalizedQuery, 'high_usage')) {
                analysis.target = 'high';
            }
            
            return analysis;
        }
        
        // 메모리 관련
        if (matchesKeyword(normalizedQuery, 'memory')) {
            analysis.metric = 'memory';
            
            // 임계값 검출
            const thresholdMatch = normalizedQuery.match(/(\d+)(%|\s*퍼센트)/);
            if (thresholdMatch) {
                analysis.threshold = parseInt(thresholdMatch[1]);
            }
            
            // 서버 유형 검출
            for (const serverType of ['web', 'db', 'api', 'app', 'cache']) {
                if (matchesKeyword(normalizedQuery, serverType)) {
                    analysis.serverType = serverType;
                    break;
                }
            }
            
            // 시간 범위 검출
            for (const timeRange of ['recent', 'today', 'yesterday', 'week', 'month']) {
                if (matchesKeyword(normalizedQuery, timeRange)) {
                    analysis.timeRange = timeRange;
                    break;
                }
            }
            
            // 상태 필터 검출
            if (matchesKeyword(normalizedQuery, 'critical')) {
                analysis.target = 'critical';
            } else if (matchesKeyword(normalizedQuery, 'warning')) {
                analysis.target = 'warning';
            } else if (matchesKeyword(normalizedQuery, 'normal')) {
                analysis.target = 'normal';
            } else if (matchesKeyword(normalizedQuery, 'high_usage')) {
                analysis.target = 'high';
            } else if (normalizedQuery.includes('누수') || normalizedQuery.includes('leak')) {
                analysis.target = 'leak';
            }
            
            return analysis;
        }
        
        // 디스크 관련
        if (matchesKeyword(normalizedQuery, 'disk')) {
            analysis.metric = 'disk';
            
            // 임계값 검출
            const thresholdMatch = normalizedQuery.match(/(\d+)(%|\s*퍼센트)/);
            if (thresholdMatch) {
                analysis.threshold = parseInt(thresholdMatch[1]);
            }
            
            // 서버 유형 검출
            for (const serverType of ['web', 'db', 'api', 'app', 'cache']) {
                if (matchesKeyword(normalizedQuery, serverType)) {
                    analysis.serverType = serverType;
                    break;
                }
            }
            
            // 시간 범위 검출
            for (const timeRange of ['recent', 'today', 'yesterday', 'week', 'month']) {
                if (matchesKeyword(normalizedQuery, timeRange)) {
                    analysis.timeRange = timeRange;
                    break;
                }
            }
            
            // 상태 필터 검출
            if (matchesKeyword(normalizedQuery, 'critical')) {
                analysis.target = 'critical';
            } else if (matchesKeyword(normalizedQuery, 'warning')) {
                analysis.target = 'warning';
            } else if (matchesKeyword(normalizedQuery, 'normal')) {
                analysis.target = 'normal';
            } else if (matchesKeyword(normalizedQuery, 'low_space')) {
                analysis.target = 'full';
            }
            
            return analysis;
        }
        
        // 네트워크 관련
        if (matchesKeyword(normalizedQuery, 'network')) {
            analysis.metric = 'network';
            
            // 네트워크 특정 키워드 검출
            if (normalizedQuery.includes('인바운드') || normalizedQuery.includes('수신') || normalizedQuery.includes('inbound')) {
                analysis.target = 'inbound';
            } else if (normalizedQuery.includes('아웃바운드') || normalizedQuery.includes('송신') || normalizedQuery.includes('outbound')) {
                analysis.target = 'outbound';
            } else if (normalizedQuery.includes('오류') || normalizedQuery.includes('에러') || normalizedQuery.includes('error')) {
                analysis.target = 'errors';
            } else if (normalizedQuery.includes('지연') || normalizedQuery.includes('느림') || normalizedQuery.includes('latency')) {
                analysis.target = 'latency';
            }
            
            // 서버 유형 검출
            for (const serverType of ['web', 'db', 'api', 'app', 'cache']) {
                if (matchesKeyword(normalizedQuery, serverType)) {
                    analysis.serverType = serverType;
                    break;
                }
            }
            
            return analysis;
        }
        
        // 서비스 관련
        if (normalizedQuery.includes('서비스') || normalizedQuery.includes('service')) {
            analysis.metric = 'service';
            
            if (normalizedQuery.includes('중단') || normalizedQuery.includes('정지') || 
                normalizedQuery.includes('stop') || normalizedQuery.includes('down')) {
                analysis.target = 'stopped';
            } else if (normalizedQuery.includes('상태') || normalizedQuery.includes('status')) {
                analysis.target = 'status';
            }
            
            // 특정 서비스 감지
            const services = ['nginx', 'apache', 'mysql', 'postgres', 'mongodb', 'redis', 'docker'];
            for (const service of services) {
                if (normalizedQuery.includes(service)) {
                    analysis.serverType = service;
                    break;
                }
            }
            
            return analysis;
        }
        
        // 서버 상태 일반 질의
        if (normalizedQuery.includes('상태') || normalizedQuery.includes('status') || 
            matchesKeyword(normalizedQuery, 'check')) {
            
            // 특정 상태에 대한 질의인지 확인
            if (matchesKeyword(normalizedQuery, 'critical')) {
                analysis.target = 'critical';
            } else if (matchesKeyword(normalizedQuery, 'warning')) {
                analysis.target = 'warning';
            } else if (matchesKeyword(normalizedQuery, 'normal')) {
                analysis.target = 'normal';
            }
            
            // 서버 유형 검출
            for (const serverType of ['web', 'db', 'api', 'app', 'cache']) {
                if (matchesKeyword(normalizedQuery, serverType)) {
                    analysis.serverType = serverType;
                    break;
                }
            }
            
            return analysis;
        }
        
        // 자세한 분석이 없는 경우 기본값 반환
        return analysis;
    }

    generateDataResponse(analysis) {
        let response = '';
        
        // 메트릭에 따른 응답 생성
        if (analysis.metric === 'cpu') {
            response = this.generateCpuResponse(analysis);
        } else if (analysis.metric === 'memory') {
            response = this.generateMemoryResponse(analysis);
        } else if (analysis.metric === 'disk') {
            response = this.generateDiskResponse(analysis);
        } else if (analysis.metric === 'network') {
            response = this.generateNetworkResponse(analysis);
        } else {
            // 기본 상태 요약
            response = this.generateGeneralStatusResponse();
        }
        
        return response;
    }

    generateCpuResponse(analysis) {
        // 필터링된 서버 데이터
        let serverList = this.serverData;
        if (analysis.serverType) {
            serverList = serverList.filter(server => server.hostname.includes(analysis.serverType));
        }
        
        // CPU 사용량 통계
        const cpuUsages = serverList.map(server => server.cpu_usage);
        const avgCpuUsage = this.calculateAverage(cpuUsages);
        const maxCpuUsage = Math.max(...cpuUsages);
        const minCpuUsage = Math.min(...cpuUsages);
        
        // 임계값 이상 서버 찾기
        const threshold = analysis.threshold || 80;
        const highCpuServers = serverList
            .filter(server => server.cpu_usage >= threshold)
            .sort((a, b) => b.cpu_usage - a.cpu_usage);
            
        let response = '';
        
        if (highCpuServers.length > 0) {
            const severityEmoji = highCpuServers[0].cpu_usage >= 90 ? this.statusEmoji.critical : this.statusEmoji.warning;
            
            response = `${severityEmoji} CPU 사용률이 ${threshold}% 이상인 서버: ${highCpuServers.length}대\n\n`;
            response += highCpuServers.slice(0, 5).map(server => 
                `${server.hostname}: ${server.cpu_usage.toFixed(1)}% (Load: ${server.load_avg_1m})`
            ).join('\n');
            
            if (highCpuServers.length > 5) {
                response += `\n\n외 ${highCpuServers.length - 5}대 서버...`;
            }
        } else {
            response = `${this.statusEmoji.normal} 모든 서버의 CPU 사용률이 ${threshold}% 미만입니다.\n\n`;
            response += `평균: ${avgCpuUsage.toFixed(1)}%, 최대: ${maxCpuUsage.toFixed(1)}%, 최소: ${minCpuUsage.toFixed(1)}%`;
        }
        
        return response;
    }

    generateMemoryResponse(analysis) {
        // 필터링된 서버 데이터
        let serverList = this.serverData;
        if (analysis.serverType) {
            serverList = serverList.filter(server => server.hostname.includes(analysis.serverType));
        }
        
        // 메모리 사용량 통계
        const memoryUsages = serverList.map(server => server.memory_usage_percent);
        const avgMemoryUsage = this.calculateAverage(memoryUsages);
        const maxMemoryUsage = Math.max(...memoryUsages);
        const minMemoryUsage = Math.min(...memoryUsages);
        
        // 임계값 이상 서버 찾기
        const threshold = analysis.threshold || 80;
        const highMemoryServers = serverList
            .filter(server => server.memory_usage_percent >= threshold)
            .sort((a, b) => b.memory_usage_percent - a.memory_usage_percent);
            
        let response = '';
        
        if (highMemoryServers.length > 0) {
            const severityEmoji = highMemoryServers[0].memory_usage_percent >= 90 ? this.statusEmoji.critical : this.statusEmoji.warning;
            
            response = `${severityEmoji} 메모리 사용률이 ${threshold}% 이상인 서버: ${highMemoryServers.length}대\n\n`;
            response += highMemoryServers.slice(0, 5).map(server => {
                const total = (server.memory_total / (1024 * 1024 * 1024)).toFixed(1);
                return `${server.hostname}: ${server.memory_usage_percent.toFixed(1)}% (총 ${total} GB)`;
            }).join('\n');
            
            if (highMemoryServers.length > 5) {
                response += `\n\n외 ${highMemoryServers.length - 5}대 서버...`;
            }
        } else {
            response = `${this.statusEmoji.normal} 모든 서버의 메모리 사용률이 ${threshold}% 미만입니다.\n\n`;
            response += `평균: ${avgMemoryUsage.toFixed(1)}%, 최대: ${maxMemoryUsage.toFixed(1)}%, 최소: ${minMemoryUsage.toFixed(1)}%`;
        }
        
        return response;
    }

    generateDiskResponse(analysis) {
        // 필터링된 서버 데이터
        let serverList = this.serverData;
        if (analysis.serverType) {
            serverList = serverList.filter(server => server.hostname.includes(analysis.serverType));
        }
        
        // 디스크 사용량 통계
        const diskUsages = serverList.map(server => server.disk[0].disk_usage_percent);
        const avgDiskUsage = this.calculateAverage(diskUsages);
        const maxDiskUsage = Math.max(...diskUsages);
        const minDiskUsage = Math.min(...diskUsages);
        
        // 임계값 이상 서버 찾기
        const threshold = analysis.threshold || 80;
        const highDiskServers = serverList
            .filter(server => server.disk[0].disk_usage_percent >= threshold)
            .sort((a, b) => b.disk[0].disk_usage_percent - a.disk[0].disk_usage_percent);
            
        let response = '';
        
        if (highDiskServers.length > 0) {
            const severityEmoji = highDiskServers[0].disk[0].disk_usage_percent >= 90 ? this.statusEmoji.critical : this.statusEmoji.warning;
            
            response = `${severityEmoji} 디스크 사용률이 ${threshold}% 이상인 서버: ${highDiskServers.length}대\n\n`;
            response += highDiskServers.slice(0, 5).map(server => {
                const total = (server.disk[0].disk_total / (1024 * 1024 * 1024)).toFixed(1);
                return `${server.hostname}: ${server.disk[0].disk_usage_percent.toFixed(1)}% (총 ${total} GB)`;
            }).join('\n');
            
            if (highDiskServers.length > 5) {
                response += `\n\n외 ${highDiskServers.length - 5}대 서버...`;
            }
        } else {
            response = `${this.statusEmoji.normal} 모든 서버의 디스크 사용률이 ${threshold}% 미만입니다.\n\n`;
            response += `평균: ${avgDiskUsage.toFixed(1)}%, 최대: ${maxDiskUsage.toFixed(1)}%, 최소: ${minDiskUsage.toFixed(1)}%`;
        }
        
        return response;
    }

    generateNetworkResponse(analysis) {
        // 필터링된 서버 데이터
        let serverList = this.serverData;
        if (analysis.serverType) {
            serverList = serverList.filter(server => server.hostname.includes(analysis.serverType));
        }
        
        // 네트워크 트래픽 계산 (GB 단위로 변환)
        const serverTraffic = serverList.map(server => ({
            hostname: server.hostname,
            rx: (server.net.rx_bytes / (1024 * 1024 * 1024)).toFixed(2),
            tx: (server.net.tx_bytes / (1024 * 1024 * 1024)).toFixed(2),
            total: ((server.net.rx_bytes + server.net.tx_bytes) / (1024 * 1024 * 1024)).toFixed(2),
            errors: server.net.rx_errors + server.net.tx_errors
        }));
        
        // 트래픽 기준 정렬
        serverTraffic.sort((a, b) => parseFloat(b.total) - parseFloat(a.total));
        
        let response = `📊 네트워크 트래픽 상위 5대 서버:\n\n`;
        
        // 상위 5개 서버 표시
        response += serverTraffic.slice(0, 5).map(server => 
            `${server.hostname}: 수신 ${server.rx} GB, 송신 ${server.tx} GB (오류: ${server.errors}개)`
        ).join('\n');
        
        // 네트워크 오류가 많은 서버 찾기
        const highErrorServers = serverTraffic
            .filter(server => server.errors > 20)
            .sort((a, b) => b.errors - a.errors);
            
        if (highErrorServers.length > 0) {
            response += `\n\n${this.statusEmoji.warning} 네트워크 오류가 많은 서버:\n`;
            response += highErrorServers.slice(0, 3).map(server => 
                `${server.hostname}: ${server.errors}개 오류`
            ).join('\n');
        }
        
        return response;
    }

    generateGeneralStatusResponse() {
        const total = this.serverData.length;
        const criticalServers = this.serverData.filter(server => 
            server.cpu_usage >= 90 || 
            server.memory_usage_percent >= 90 || 
            server.disk[0].disk_usage_percent >= 90
        );
        const warningServers = this.serverData.filter(server => 
            (server.cpu_usage >= 70 && server.cpu_usage < 90) || 
            (server.memory_usage_percent >= 70 && server.memory_usage_percent < 90) || 
            (server.disk[0].disk_usage_percent >= 70 && server.disk[0].disk_usage_percent < 90)
        );
        
        const stoppedServices = [];
        this.serverData.forEach(server => {
            Object.entries(server.services).forEach(([service, status]) => {
                if (status === 'stopped') {
                    stoppedServices.push(`${server.hostname}: ${service}`);
                }
            });
        });
        
        let response = `📊 전체 서버 상태 요약 (총 ${total}대)\n\n`;
        
        if (criticalServers.length > 0) {
            response += `${this.statusEmoji.critical} 심각(Critical): ${criticalServers.length}대\n`;
        }
        
        if (warningServers.length > 0) {
            response += `${this.statusEmoji.warning} 주의(Warning): ${warningServers.length}대\n`;
        }
        
        response += `${this.statusEmoji.normal} 정상(Normal): ${total - criticalServers.length - warningServers.length}대\n`;
        
        if (stoppedServices.length > 0) {
            response += `\n🛑 중단된 서비스: ${stoppedServices.length}개\n`;
            const topStoppedServices = stoppedServices.slice(0, 3);
            response += topStoppedServices.join('\n');
            
            if (stoppedServices.length > 3) {
                response += `\n외 ${stoppedServices.length - 3}개...`;
            }
        }
        
        return response;
    }

    generateProblemAnalysis() {
        // 서버에서 감지된 문제 찾기
        const problems = [];
        
        this.serverData.forEach(server => {
            this.problemPatterns.forEach(pattern => {
                if (pattern.condition(server)) {
                    problems.push({
                        serverName: server.hostname,
                        problemId: pattern.id,
                        description: pattern.description,
                        severity: pattern.severity
                    });
                }
            });
        });
        
        if (problems.length === 0) {
            return `${this.statusEmoji.normal} 현재 감지된 주요 문제가 없습니다.`;
        }
        
        // 문제 유형별로 그룹화
        const problemGroups = {};
        problems.forEach(problem => {
            if (!problemGroups[problem.problemId]) {
                problemGroups[problem.problemId] = [];
            }
            problemGroups[problem.problemId].push(problem);
        });
        
        // 중요도 순 정렬
        const sortedProblemTypes = Object.keys(problemGroups).sort((a, b) => {
            const severityRank = { critical: 0, warning: 1 };
            const patternA = this.problemPatterns.find(p => p.id === a);
            const patternB = this.problemPatterns.find(p => p.id === b);
            return severityRank[patternA.severity] - severityRank[patternB.severity];
        });
        
        let response = `📊 자동 문제 분석 결과:\n\n`;
        
        sortedProblemTypes.forEach(problemId => {
            const pattern = this.problemPatterns.find(p => p.id === problemId);
            const serversWithProblem = problemGroups[problemId];
            
            const emoji = pattern.severity === 'critical' ? this.statusEmoji.critical : this.statusEmoji.warning;
            
            response += `${emoji} ${pattern.description}\n`;
            response += `- 영향 받는 서버: ${serversWithProblem.length}대\n`;
            response += `- 주요 서버: ${serversWithProblem.slice(0, 3).map(p => p.serverName).join(', ')}`;
            
            if (serversWithProblem.length > 3) {
                response += ` 외 ${serversWithProblem.length - 3}대`;
            }
            
            response += `\n\n`;
        });
        
        response += '상세 조치 방법은 "CPU 문제 해결 방법" 또는 "디스크 문제 해결 방법"과 같이 질문해주세요.';
        
        return response;
    }

    generateSolutions(problemId) {
        if (!problemId) {
            return '어떤 문제에 대한 해결 방법이 필요한지 구체적으로 질문해주세요. (예: "CPU 문제 해결 방법", "메모리 문제 해결 방법")';
        }
        
        const problem = this.problemPatterns.find(p => p.id === problemId);
        if (!problem) {
            return '해당 문제에 대한 정보를 찾을 수 없습니다. 다른 문제에 대해 질문해주세요.';
        }
        
        const emoji = problem.severity === 'critical' ? this.statusEmoji.critical : this.statusEmoji.warning;
        
        let response = `${emoji} ${problem.description} - 해결 방법\n\n`;
        
        response += `🔍 가능한 원인:\n`;
        problem.causes.forEach(cause => {
            response += `- ${cause}\n`;
        });
        
        response += `\n🛠️ 권장 조치:\n`;
        problem.solutions.forEach(solution => {
            response += `- ${solution}\n`;
        });
        
        return response;
    }

    generateReportDownloadLink(reportType) {
        const reportTypes = {
            'incident': '장애 보고서',
            'performance': '성능 보고서',
            'resource': '자원 사용량 보고서',
            'general': '일반 상태 보고서'
        };
        
        const reportTypeName = reportTypes[reportType] || '상태 보고서';
        
        // 가상의 다운로드 링크를 생성
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `${reportTypeName}_${timestamp}.pdf`;
        
        return `📊 ${reportTypeName}가 생성되었습니다.\n\n다운로드를 시작하려면 <a href="#" onclick="alert('실제 환경에서는 이 링크를 통해 보고서가 다운로드됩니다.'); return false;">${filename}</a>를 클릭하세요.`;
    }

    detectProblems() {
        if (!this.serverData || this.serverData.length === 0) {
            console.warn('서버 데이터가 없어 문제를 감지할 수 없습니다.');
            return [];
        }
        
        const problems = [];
        
        // 서버 상태 분석
        this.serverData.forEach(server => {
            // CPU 과부하 감지
            if (server.cpu_usage >= 90) {
                problems.push({
                    severity: 'Critical',
                    serverHostname: server.hostname,
                    description: `CPU 과부하 (${server.cpu_usage}%)`,
                    solution: '불필요한 프로세스를 종료하거나 자원을 확장하세요.',
                    timestamp: new Date().toISOString(),
                    commands: [
                        'top -c -b -n 1 | head -20',
                        'ps aux --sort=-%cpu | head -10',
                        'mpstat -P ALL',
                        'vmstat 1 5'
                    ],
                    causes: [
                        '과도한 부하를 일으키는 프로세스 실행 중',
                        '시스템 자원 부족으로 인한 경합 상태',
                        'CPU 바운드 작업(인코딩, 계산) 과다 실행'
                    ]
                });
            } else if (server.cpu_usage >= 80) {
                problems.push({
                    severity: 'Warning',
                    serverHostname: server.hostname,
                    description: `CPU 사용량 높음 (${server.cpu_usage}%)`,
                    solution: 'CPU 사용량을 모니터링하고 추세를 확인하세요.',
                    timestamp: new Date().toISOString(),
                    commands: [
                        'top -c -b -n 1 | head -20',
                        'ps aux --sort=-%cpu | head -10',
                        'uptime' 
                    ],
                    causes: [
                        '일시적인 부하 증가',
                        '백그라운드 작업 증가',
                        '비효율적인 어플리케이션 코드'
                    ]
                });
            }
            
            // 메모리 부족 감지
            if (server.memory_usage_percent >= 90) {
                problems.push({
                    severity: 'Critical',
                    serverHostname: server.hostname,
                    description: `메모리 부족 (${server.memory_usage_percent}%)`,
                    solution: '메모리 누수 확인 또는 자원을 확장하세요.',
                    timestamp: new Date().toISOString(),
                    commands: [
                        'free -m',
                        'ps aux --sort=-%mem | head -10',
                        'vmstat -s',
                        'cat /proc/meminfo',
                        'dmesg | grep -i memory'
                    ],
                    causes: [
                        '메모리 누수가 발생하는 프로세스',
                        '스왑 공간 부족',
                        '메모리 캐시 설정 오류'
                    ]
                });
            } else if (server.memory_usage_percent >= 80) {
                problems.push({
                    severity: 'Warning',
                    serverHostname: server.hostname,
                    description: `메모리 사용량 높음 (${server.memory_usage_percent}%)`,
                    solution: '메모리 사용량을 모니터링하고 추세를 확인하세요.',
                    timestamp: new Date().toISOString(),
                    commands: [
                        'free -m',
                        'ps aux --sort=-%mem | head -10',
                        'vmstat 1 5'
                    ],
                    causes: [
                        '일시적인 메모리 사용 증가',
                        '캐시 증가',
                        '더 많은 애플리케이션 동시 실행'
                    ]
                });
            }
            
            // 디스크 공간 부족 감지
            if (server.disk && server.disk.length > 0) {
                if (server.disk[0].disk_usage_percent >= 90) {
                    problems.push({
                        severity: 'Critical',
                        serverHostname: server.hostname,
                        description: `디스크 공간 부족 (${server.disk[0].disk_usage_percent}%)`,
                        solution: '불필요한 파일을 제거하거나 디스크 공간을 확장하세요.',
                        timestamp: new Date().toISOString(),
                        commands: [
                            'df -h',
                            'du -sh /* | sort -hr | head -10',
                            'find / -type f -size +100M -exec ls -lh {} \\;',
                            'find /var/log -name "*.log" -size +50M'
                        ],
                        causes: [
                            '로그 파일 과다 누적',
                            '임시 파일 미정리',
                            '대용량 데이터 파일 증가'
                        ]
                    });
                } else if (server.disk[0].disk_usage_percent >= 80) {
                    problems.push({
                        severity: 'Warning',
                        serverHostname: server.hostname,
                        description: `디스크 공간 부족 임박 (${server.disk[0].disk_usage_percent}%)`,
                        solution: '디스크 공간을 모니터링하고 정리 계획을 수립하세요.',
                        timestamp: new Date().toISOString(),
                        commands: [
                            'df -h',
                            'du -sh /* | sort -hr | head -10',
                            'find /var/log -name "*.log" -size +20M'
                        ],
                        causes: [
                            '로그 파일 증가 중',
                            '사용자 데이터 증가',
                            '백업 파일 공간 증가'
                        ]
                    });
                }
            }
            
            // 서비스 중단 감지
            if (server.services) {
                Object.entries(server.services).forEach(([serviceName, status]) => {
                    if (status === 'stopped') {
                        problems.push({
                            severity: 'Critical',
                            serverHostname: server.hostname,
                            description: `${serviceName} 서비스 중단`,
                            solution: `${serviceName} 서비스를 재시작하고 로그를 확인하세요.`,
                            timestamp: new Date().toISOString(),
                            commands: [
                                `systemctl status ${serviceName}`,
                                `journalctl -u ${serviceName} -n 50`,
                                `systemctl restart ${serviceName}`,
                                `ps aux | grep ${serviceName}`
                            ],
                            causes: [
                                '서비스 충돌 발생',
                                '의존성 서비스 장애',
                                '리소스 부족으로 인한 중단',
                                '설정 파일 오류'
                            ]
                        });
                    }
                });
            }
            
            // 오류 메시지 감지
            if (server.errors && server.errors.length > 0) {
                server.errors.forEach(error => {
                    // 오류 메시지에서 명령어가 포함되어 있는지 확인
                    const commandMatch = error.match(/\(([^)]+)\)$/);
                    const command = commandMatch ? commandMatch[1] : 'journalctl -f';
                    
                    // 명령어 목록 생성
                    const commands = [command];
                    
                    // 심각도 판단
                    let severity = 'Warning';
                    if (error.toLowerCase().includes('critical')) {
                        severity = 'Critical';
                        commands.push('dmesg | tail -50');
                    } else if (error.toLowerCase().includes('error')) {
                        commands.push('grep -i error /var/log/syslog | tail -20');
                    }
                    
                    problems.push({
                        severity: severity,
                        serverHostname: server.hostname,
                        description: `오류 감지: ${error.replace(/\s*\([^)]*\)$/, '')}`, // 괄호 속 명령어는 설명에서 제거
                        solution: '로그 파일을 확인하고 근본 원인을 분석하세요.',
                        timestamp: new Date().toISOString(),
                        commands: commands,
                        causes: [
                            '시스템 또는 애플리케이션 오류 발생',
                            '보안 이슈 발생 가능성',
                            '리소스 부족으로 인한 오류'
                        ]
                    });
                });
            }
        });
        
        return problems;
    }
    
    generateErrorReport() {
        const problems = this.detectProblems();
        if (problems.length === 0) {
            return '# 서버 상태 보고서\n\n현재 감지된 문제가 없습니다. 모든 서버가 정상적으로 작동 중입니다.\n\n생성 시간: ' + new Date().toLocaleString();
        }
        
        // 문제를 심각도별로 분류
        const criticalProblems = problems.filter(p => p.severity === 'Critical');
        const warningProblems = problems.filter(p => p.severity === 'Warning' || p.severity === 'Error');
        
        // 보고서 생성
        let report = '# 서버 상태 보고서\n\n';
        report += `생성 시간: ${new Date().toLocaleString()}\n\n`;
        report += `총 문제 수: ${problems.length}\n`;
        report += `- 심각: ${criticalProblems.length}\n`;
        report += `- 경고: ${warningProblems.length}\n\n`;
        
        if (criticalProblems.length > 0) {
            report += '## 심각한 문제\n\n';
            criticalProblems.forEach(problem => {
                report += `### ${problem.serverHostname}: ${problem.description}\n`;
                
                // 원인 분석 추가
                if (problem.causes && problem.causes.length > 0) {
                    report += '#### 추정 원인:\n';
                    problem.causes.forEach(cause => {
                        report += `- ${cause}\n`;
                    });
                    report += '\n';
                }
                
                report += `#### 해결 방안:\n- ${problem.solution}\n\n`;
                
                // 확인 명령어 추가
                if (problem.commands && problem.commands.length > 0) {
                    report += '#### 확인 명령어:\n```bash\n';
                    problem.commands.forEach(cmd => {
                        report += `${cmd}\n`;
                    });
                    report += '```\n\n';
                }
                
                report += `감지 시간: ${new Date(problem.timestamp).toLocaleString()}\n\n`;
                report += `---\n\n`;
            });
        }
        
        if (warningProblems.length > 0) {
            report += '## 경고\n\n';
            warningProblems.forEach(problem => {
                report += `### ${problem.serverHostname}: ${problem.description}\n`;
                
                // 원인 분석 추가
                if (problem.causes && problem.causes.length > 0) {
                    report += '#### 추정 원인:\n';
                    problem.causes.forEach(cause => {
                        report += `- ${cause}\n`;
                    });
                    report += '\n';
                }
                
                report += `#### 해결 방안:\n- ${problem.solution}\n\n`;
                
                // 확인 명령어 추가
                if (problem.commands && problem.commands.length > 0) {
                    report += '#### 확인 명령어:\n```bash\n';
                    problem.commands.forEach(cmd => {
                        report += `${cmd}\n`;
                    });
                    report += '```\n\n';
                }
                
                report += `감지 시간: ${new Date(problem.timestamp).toLocaleString()}\n\n`;
                report += `---\n\n`;
            });
        }
        
        report += '## 서버 성능 요약\n\n';
        
        // 서버 성능 요약
        if (this.serverData && this.serverData.length > 0) {
            const avgCpu = (this.serverData.reduce((sum, server) => sum + server.cpu_usage, 0) / this.serverData.length).toFixed(1);
            const avgMem = (this.serverData.reduce((sum, server) => sum + server.memory_usage_percent, 0) / this.serverData.length).toFixed(1);
            
            report += `- 평균 CPU 사용률: ${avgCpu}%\n`;
            report += `- 평균 메모리 사용률: ${avgMem}%\n`;
            report += `- 총 서버 수: ${this.serverData.length}\n\n`;
            
            // 상위 리소스 사용 서버 목록
            report += '### 상위 CPU 사용 서버\n\n';
            const topCpuServers = [...this.serverData]
                .sort((a, b) => b.cpu_usage - a.cpu_usage)
                .slice(0, 5);
            
            topCpuServers.forEach(server => {
                report += `- ${server.hostname}: ${server.cpu_usage}% (${this.getStatusLabel(this.getEffectiveServerStatus(server))})\n`;
            });
            
            report += '\n### 상위 메모리 사용 서버\n\n';
            const topMemServers = [...this.serverData]
                .sort((a, b) => b.memory_usage_percent - a.memory_usage_percent)
                .slice(0, 5);
            
            topMemServers.forEach(server => {
                report += `- ${server.hostname}: ${server.memory_usage_percent}% (${this.getStatusLabel(this.getEffectiveServerStatus(server))})\n`;
            });
            
            report += '\n### 일반적인 서버 상태 확인 명령어\n\n';
            report += '```bash\n';
            report += '# 시스템 전체 상태 확인\n';
            report += 'top -c          # 실시간 프로세스 모니터링\n';
            report += 'htop            # 향상된 대화형 프로세스 뷰어\n';
            report += 'free -h         # 메모리 사용량 확인\n';
            report += 'df -h           # 디스크 사용량 확인\n';
            report += 'uptime          # 부하 및 가동 시간 확인\n';
            report += 'dmesg | tail    # 최근 커널 메시지 확인\n\n';
            report += '# 로그 확인\n';
            report += 'journalctl -f   # 실시간 시스템 로그 확인\n';
            report += 'tail -f /var/log/syslog    # 시스템 로그 확인\n';
            report += 'grep -i error /var/log/syslog  # 오류 로그 검색\n';
            report += '```\n';
        }
        
        return report;
    }
    
    // 상태에 따른 라벨 반환 (보고서 생성용)
    getStatusLabel(status) {
        switch(status) {
            case 'critical': return '심각';
            case 'warning': return '경고';
            case 'normal': return '정상';
            default: return '알 수 없음';
        }
    }

    calculateAverage(numbers) {
        if (numbers.length === 0) return 0;
        return numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
    }
}

// 전역 함수로 항상 노출
window.processQuery = async function(query) {
    if (!window.aiProcessor) {
        // AIProcessor 인스턴스 없으면 생성
        console.log("Creating global AIProcessor instance");
        window.aiProcessor = new AIProcessor();
        // 데이터 초기화 대기
        await new Promise(resolve => setTimeout(resolve, 200));
    }
    return await window.aiProcessor.processQuery(query);
};

// 페이지 로드 시 즉시 AIProcessor 인스턴스 생성
document.addEventListener('DOMContentLoaded', function() {
    if (!window.aiProcessor) {
        console.log("Initializing AIProcessor on page load");
        window.aiProcessor = new AIProcessor();
    }
});

// MCP 서버 연동 함수 (context 인자화)
async function fetchFromMCP(query, context = "server-status") {
  try {
    const response = await fetch(CONFIG.MCP_SERVER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        query: query,
        context: context
      })
    });

    if (!response.ok) throw new Error("MCP 서버 오류");

    const data = await response.json();
    return data.result || "MCP 응답이 없습니다.";
  } catch (error) {
    console.error("MCP 요청 실패:", error);
    return "AI 응답 생성에 실패했습니다. 잠시 후 다시 시도해주세요.";
  }
}

// 기존 키워드 매칭 함수 예시 (실제 프로젝트에 맞게 연결)
function keywordMatchAnswer(query) {
  if (query.includes('CPU')) return 'CPU 사용률이 높은 서버는 server-01, server-02입니다.';
  if (query.includes('메모리')) return '메모리 사용량이 많은 서버는 server-03입니다.';
  if (query.includes('디스크')) return '디스크 공간이 부족한 서버는 server-04입니다.';
  return '적절한 답변을 찾지 못했습니다.';
}

// MCP 우선, 실패 시 fallback 구조
export async function processQuery(query) {
  if (!query || query === 'undefined') return '질문이 비어있거나 올바르지 않습니다.';
  const mcpResult = await fetchFromMCP(query);
  if (mcpResult && mcpResult !== 'undefined' && mcpResult.trim() !== '') {
    return mcpResult;
  }
  const fallback = keywordMatchAnswer(query);
  if (!fallback || fallback === 'undefined' || fallback.trim() === '') {
    return '적절한 답변을 찾지 못했습니다.';
  }
  return fallback;
} 