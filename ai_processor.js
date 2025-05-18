/**
 * OpenManager AI - AI 질의 프로세서
 * 서버 모니터링 데이터를 분석하여 자연어 질의에 응답하고
 * 자동 문제 분석 및 해결 방법을 제공합니다.
 */

class AIProcessor {
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
        // 지금은 getEffectiveServerStatus를 우선적으로 사용하도록 변경.
        if (this.getEffectiveServerStatus) {
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
        
        // 문제 분석 요청
        if (normalizedQuery.includes('문제') && normalizedQuery.includes('분석')) {
            analysis.requestType = 'problem_analysis';
            return analysis;
        }
        
        // 해결 방법 요청
        if (normalizedQuery.includes('해결') || normalizedQuery.includes('방법') || normalizedQuery.includes('조치')) {
            analysis.requestType = 'solution';
            
            // 해결해야 할 문제 유형 분석
            if (normalizedQuery.includes('cpu')) {
                analysis.target = 'critical_cpu';
            } else if (normalizedQuery.includes('메모리') || normalizedQuery.includes('ram')) {
                analysis.target = 'critical_memory';
            } else if (normalizedQuery.includes('디스크') || normalizedQuery.includes('저장공간')) {
                analysis.target = 'critical_disk';
            } else if (normalizedQuery.includes('서비스') || normalizedQuery.includes('중단')) {
                analysis.target = 'service_down';
            } else if (normalizedQuery.includes('네트워크') || normalizedQuery.includes('연결')) {
                analysis.target = 'network_errors';
            }
            
            return analysis;
        }
        
        // 보고서 요청
        if (normalizedQuery.includes('보고서') || normalizedQuery.includes('리포트') || normalizedQuery.includes('다운로드')) {
            analysis.requestType = 'report';
            
            if (normalizedQuery.includes('장애') || normalizedQuery.includes('인시던트')) {
                analysis.reportType = 'incident';
            } else if (normalizedQuery.includes('성능') || normalizedQuery.includes('퍼포먼스')) {
                analysis.reportType = 'performance';
            } else if (normalizedQuery.includes('자원') || normalizedQuery.includes('리소스')) {
                analysis.reportType = 'resource';
            } else {
                analysis.reportType = 'general';
            }
            
            return analysis;
        }
        
        // 일반 질의 분석
        
        // 메트릭 분석
        if (normalizedQuery.includes('cpu')) {
            analysis.metric = 'cpu';
        } else if (normalizedQuery.includes('메모리') || normalizedQuery.includes('ram')) {
            analysis.metric = 'memory';
        } else if (normalizedQuery.includes('디스크') || normalizedQuery.includes('저장공간')) {
            analysis.metric = 'disk';
        } else if (normalizedQuery.includes('네트워크') || normalizedQuery.includes('트래픽')) {
            analysis.metric = 'network';
        }
        
        // 서버 유형 분석
        const serverTypes = ['web', 'app', 'db', 'cache', 'api', 'auth', 'cdn', 'monitor'];
        for (const type of serverTypes) {
            if (normalizedQuery.includes(type)) {
                analysis.serverType = type;
                break;
            }
        }
        
        // 임계값 분석
        const thresholdMatch = normalizedQuery.match(/(\d+)\s*(%|퍼센트)/);
        if (thresholdMatch) {
            analysis.threshold = parseInt(thresholdMatch[1]);
        }
        
        // 시간 범위 분석
        if (normalizedQuery.includes('과거') || normalizedQuery.includes('지난') || normalizedQuery.includes('이전')) {
            analysis.timeRange = 'past';
        }
        
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
        // 감지된 문제 목록
        const problems = [];
        
        if (!this.serverData || this.serverData.length === 0) {
            return problems;
        }
        
        // 각 서버별로 문제 패턴 검사
        this.serverData.forEach(server => {
            // 서버 상태 확인
            const serverStatus = this.getEffectiveServerStatus(server);
            
            // 문제 패턴 검사
            this.problemPatterns.forEach(pattern => {
                if (pattern.condition(server)) {
                    // 패턴 조건에 맞는 문제 발견시
                    problems.push({
                        serverHostname: server.hostname,
                        description: pattern.description,
                        severity: pattern.severity === 'critical' ? 'Critical' : 'Warning', // UI 표시용 포맷으로 변환
                        solution: pattern.solutions.join(' '),
                        causes: pattern.causes.join(', '),
                        timestamp: new Date().toISOString()
                    });
                }
            });
        });
        
        return problems;
    }

    generateErrorReport() {
        const problems = this.detectProblems();
        if (problems.length === 0) {
            return "=== 서버 오류 보고서 ===\n\n현재 감지된 문제가 없습니다.\n\n생성 시각: " + new Date().toLocaleString();
        }

        let report = "=== 서버 오류 보고서 ===\n\n";
        report += `총 ${problems.length}개의 문제가 감지되었습니다.\n`;
        report += `생성 시각: ${new Date().toLocaleString()}\n\n`;

        // 심각도별 그룹화
        const criticalProblems = problems.filter(p => p.severity === 'Critical');
        const warningProblems = problems.filter(p => p.severity === 'Warning');

        // 심각 문제 목록
        if (criticalProblems.length > 0) {
            report += `=== 심각 (${criticalProblems.length}개) ===\n\n`;
            criticalProblems.forEach((problem, index) => {
                report += this.formatProblemForReport(problem, index + 1);
            });
        }

        // 경고 문제 목록
        if (warningProblems.length > 0) {
            report += `=== 경고 (${warningProblems.length}개) ===\n\n`;
            warningProblems.forEach((problem, index) => {
                report += this.formatProblemForReport(problem, index + 1);
            });
        }

        return report;
    }

    formatProblemForReport(problem, index) {
        return `${index}. ${problem.serverHostname}\n` +
               `   문제: ${problem.description}\n` +
               `   원인: ${problem.causes}\n` +
               `   해결책: ${problem.solution}\n\n`;
    }

    calculateAverage(numbers) {
        if (numbers.length === 0) return 0;
        return numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
    }
}

// 전역 함수로 항상 노출
window.processQuery = async function(query) {
    if (!window.aiProcessor) {
        window.aiProcessor = new AIProcessor();
        // 데이터 초기화 대기
        await new Promise(resolve => setTimeout(resolve, 200));
    }
    return await window.aiProcessor.processQuery(query);
}; 