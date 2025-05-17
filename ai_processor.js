class AIProcessor {
    constructor() {
        this.serverData = null;
        this.initializeData();
        this.setupDataListener();
        this.statusEmoji = {
            normal: '✅',
            warning: '⚠️',
            critical: '��'
        };
    }

    setupDataListener() {
        window.addEventListener('serverDataUpdated', (event) => {
            this.serverData = event.detail;
        });
    }

    async initializeData() {
        this.serverData = window.serverData || [];
    }

    async processQuery(query) {
        if (!this.serverData || this.serverData.length === 0) {
            return '서버 데이터를 불러오는 중입니다. 잠시 후 다시 시도해주세요.';
        }

        // 영어 기술 용어만 허용하고 나머지는 한국어로 변환
        const processedQuery = this.processEnglishTerms(query);
        const analysis = this.analyzeQuery(processedQuery);
        return this.generateResponse(analysis);
    }

    processEnglishTerms(query) {
        // 영어 기술 용어 매핑
        const techTerms = {
            'cpu': 'cpu',
            'ram': '램',
            'memory': '메모리',
            'hdd': '하드디스크',
            'ssd': 'ssd',
            'disk': '디스크',
            'network': '네트워크',
            'traffic': '트래픽',
            'bandwidth': '대역폭',
            'load': '부하',
            'usage': '사용량',
            'error': '오류',
            'warning': '경고',
            'critical': '심각',
            'performance': '성능',
            'status': '상태'
        };

        // 영어 기술 용어만 유지하고 나머지는 한국어로 변환
        let processedQuery = query.toLowerCase();
        for (const [eng, kor] of Object.entries(techTerms)) {
            if (processedQuery.includes(eng)) {
                processedQuery = processedQuery.replace(eng, kor);
            }
        }

        return processedQuery;
    }

    analyzeQuery(query) {
        // 키워드 매핑 (한글 중심)
        const keywordMapping = {
            cpu: ['cpu', '프로세서', '처리량', '로드', '부하', '처리'],
            memory: ['메모리', '램', '메모리 사용량', '메모리 상태', '메모리 점유율'],
            disk: ['디스크', '저장공간', '스토리지', '하드디스크', 'ssd', '디스크 공간'],
            network: ['네트워크', '트래픽', '대역폭', '통신', '연결', '속도'],
            performance: ['성능', '속도', '지연', '응답시간', '처리속도', '상태'],
            error: ['오류', '에러', '문제', '장애', '경고', '실패']
        };

        const analysis = {
            type: null,
            metrics: [],
            timeRange: 'current',
            severity: 'normal',
            comparison: null,
            threshold: null,
            serverFilter: null,
            regionFilter: null
        };

        // 키워드 매칭 (한글 중심)
        for (const [type, keywords] of Object.entries(keywordMapping)) {
            if (keywords.some(word => query.includes(word))) {
                analysis.type = type;
                break;
            }
        }

        // 시간 범위 분석
        const timePatterns = {
            past: ['지난', '이전', '과거', '전'],
            current: ['현재', '지금', '이번']
        };

        for (const [range, patterns] of Object.entries(timePatterns)) {
            if (patterns.some(word => query.includes(word))) {
                analysis.timeRange = range;
                break;
            }
        }

        // 심각도 분석
        const severityPatterns = {
            critical: ['심각', '위험', '긴급', '치명'],
            warning: ['주의', '경고', '주의']
        };

        for (const [severity, patterns] of Object.entries(severityPatterns)) {
            if (patterns.some(word => query.includes(word))) {
                analysis.severity = severity;
                break;
            }
        }

        // 비교 분석
        const comparisonPatterns = ['비교', '차이', '대비', '대조'];
        if (comparisonPatterns.some(word => query.includes(word))) {
            analysis.comparison = true;
        }

        // 임계값 분석
        const thresholdPattern = /(\d+)\s*%/;
        const thresholdMatch = query.match(thresholdPattern);
        if (thresholdMatch) {
            analysis.threshold = parseInt(thresholdMatch[1]);
        }

        // 서버 필터 분석
        const serverPattern = /(web|app|db|cache|api|auth|cdn|monitor)-/i;
        const serverMatch = query.match(serverPattern);
        if (serverMatch) {
            analysis.serverFilter = serverMatch[1].toLowerCase();
        }

        // 지역 필터 분석
        const regionPattern = /(kr|us|eu|jp|sg)/i;
        const regionMatch = query.match(regionPattern);
        if (regionMatch) {
            analysis.regionFilter = regionMatch[1].toLowerCase();
        }

        return analysis;
    }

    generateResponse(analysis) {
        if (!analysis.type) {
            return '죄송합니다. 질문을 이해하지 못했습니다. 서버 상태, 성능, 리소스 사용량 등에 대해 질문해주세요.';
        }

        const data = this.getRelevantData(analysis);
        return this.formatResponse(data, analysis);
    }

    getRelevantData(analysis) {
        const relevantData = {
            cpu: this.analyzeCPUData(),
            memory: this.analyzeMemoryData(),
            disk: this.analyzeDiskData(),
            network: this.analyzeNetworkData(),
            performance: this.analyzePerformanceData(),
            error: this.analyzeErrorData()
        };

        return relevantData[analysis.type] || null;
    }

    analyzeCPUData() {
        const cpuData = this.serverData.map(server => ({
            name: server.name,
            usage: server.cpu_usage,
            load: server.cpu_load
        }));

        const average = this.calculateAverage(cpuData.map(d => d.usage));
        const highest = Math.max(...cpuData.map(d => d.usage));
        const lowest = Math.min(...cpuData.map(d => d.usage));

        return {
            average,
            highest,
            lowest,
            details: cpuData,
            status: this.getStatus(average, 'cpu'),
            highLoadServers: cpuData.filter(d => d.usage > 80)
        };
    }

    analyzeMemoryData() {
        const memoryData = this.serverData.map(server => ({
            name: server.name,
            usage: server.memory_usage,
            total: server.memory_total
        }));

        const average = this.calculateAverage(memoryData.map(d => d.usage));
        const highest = Math.max(...memoryData.map(d => d.usage));
        const lowest = Math.min(...memoryData.map(d => d.usage));

        return {
            average,
            highest,
            lowest,
            details: memoryData,
            status: this.getStatus(average, 'memory'),
            highUsageServers: memoryData.filter(d => d.usage > 85)
        };
    }

    analyzeDiskData() {
        const diskData = this.serverData.map(server => ({
            name: server.name,
            usage: server.disk_usage,
            total: server.disk_total
        }));

        const average = this.calculateAverage(diskData.map(d => d.usage));
        const highest = Math.max(...diskData.map(d => d.usage));
        const lowest = Math.min(...diskData.map(d => d.usage));

        return {
            average,
            highest,
            lowest,
            details: diskData,
            status: this.getStatus(average, 'disk'),
            highUsageServers: diskData.filter(d => d.usage > 90)
        };
    }

    analyzeNetworkData() {
        const networkData = this.serverData.map(server => ({
            name: server.name,
            traffic: server.network_traffic,
            bandwidth: server.network_bandwidth
        }));

        const average = this.calculateAverage(networkData.map(d => d.traffic));
        const highest = Math.max(...networkData.map(d => d.traffic));
        const lowest = Math.min(...networkData.map(d => d.traffic));

        return {
            average,
            highest,
            lowest,
            details: networkData,
            status: this.getStatus(average, 'network'),
            highTrafficServers: networkData.filter(d => d.traffic > d.bandwidth * 0.8)
        };
    }

    analyzePerformanceData() {
        const cpu = this.analyzeCPUData();
        const memory = this.analyzeMemoryData();
        const disk = this.analyzeDiskData();
        const network = this.analyzeNetworkData();

        const overallStatus = this.getOverallStatus([cpu, memory, disk, network]);

        return {
            cpu,
            memory,
            disk,
            network,
            status: overallStatus
        };
    }

    analyzeErrorData() {
        const errors = this.serverData.filter(server => server.errors.length > 0);
        const criticalErrors = errors.filter(server => 
            server.errors.some(error => error.toLowerCase().includes('critical') || error.toLowerCase().includes('fatal'))
        );

        return {
            count: errors.length,
            criticalCount: criticalErrors.length,
            details: errors.map(server => ({
                name: server.name,
                errors: server.errors
            })),
            status: criticalErrors.length > 0 ? 'critical' : errors.length > 0 ? 'warning' : 'normal'
        };
    }

    calculateAverage(numbers) {
        return numbers.reduce((a, b) => a + b, 0) / numbers.length;
    }

    getStatus(value, type) {
        const thresholds = {
            cpu: { warning: 70, critical: 85 },
            memory: { warning: 75, critical: 90 },
            disk: { warning: 80, critical: 90 },
            network: { warning: 70, critical: 85 }
        };

        if (value >= thresholds[type].critical) return 'critical';
        if (value >= thresholds[type].warning) return 'warning';
        return 'normal';
    }

    getOverallStatus(metrics) {
        const statuses = metrics.map(m => m.status);
        if (statuses.includes('critical')) return 'critical';
        if (statuses.includes('warning')) return 'warning';
        return 'normal';
    }

    formatResponse(data, analysis) {
        if (!data) return '데이터를 분석할 수 없습니다.';

        let response = '';

        // 서버/지역 필터 적용
        if (analysis.serverFilter || analysis.regionFilter) {
            response += `필터링된 결과:\n`;
            if (analysis.serverFilter) {
                response += `서버 유형: ${analysis.serverFilter.toUpperCase()}\n`;
            }
            if (analysis.regionFilter) {
                response += `지역: ${analysis.regionFilter.toUpperCase()}\n`;
            }
            response += '\n';
        }

        // 기존 응답 포맷팅 로직
        switch (analysis.type) {
            case 'cpu':
                response += this.formatCPUResponse(data, analysis);
                break;
            case 'memory':
                response += this.formatMemoryResponse(data, analysis);
                break;
            case 'disk':
                response += this.formatDiskResponse(data, analysis);
                break;
            case 'network':
                response += this.formatNetworkResponse(data, analysis);
                break;
            case 'performance':
                response += this.formatPerformanceResponse(data, analysis);
                break;
            case 'error':
                response += this.formatErrorResponse(data, analysis);
                break;
            default:
                response += '분석 결과를 표시할 수 없습니다.';
        }
        return response;
    }

    formatCPUResponse(data, analysis) {
        let response = `${this.statusEmoji[data.status]} CPU 상태 분석 결과:\n\n`;
        if (analysis.threshold) {
            const serversAboveThreshold = data.details.filter(d => d.usage > analysis.threshold);
            response += `임계값 ${analysis.threshold}% 이상 사용 중인 서버: ${serversAboveThreshold.length}대\n\n`;
        }
        response += `전체 평균: ${data.average.toFixed(1)}%\n`;
        response += `최고 사용량: ${data.highest.toFixed(1)}%\n`;
        response += `최저 사용량: ${data.lowest.toFixed(1)}%\n\n`;
        if (data.highLoadServers.length > 0) {
            response += `높은 부하 서버:\n`;
            data.highLoadServers.forEach(server => {
                response += `- ${server.name}: ${server.usage.toFixed(1)}%\n`;
            });
        }
        return response;
    }

    formatMemoryResponse(data, analysis) {
        let response = `${this.statusEmoji[data.status]} 메모리 상태 분석 결과:\n\n`;
        if (analysis.threshold) {
            const serversAboveThreshold = data.details.filter(d => d.usage > analysis.threshold);
            response += `임계값 ${analysis.threshold}% 이상 사용 중인 서버: ${serversAboveThreshold.length}대\n\n`;
        }
        response += `전체 평균: ${data.average.toFixed(1)}%\n`;
        response += `최고 사용량: ${data.highest.toFixed(1)}%\n`;
        response += `최저 사용량: ${data.lowest.toFixed(1)}%\n\n`;
        if (data.highUsageServers.length > 0) {
            response += `높은 사용량 서버:\n`;
            data.highUsageServers.forEach(server => {
                response += `- ${server.name}: ${server.usage.toFixed(1)}%\n`;
            });
        }
        return response;
    }

    formatDiskResponse(data, analysis) {
        let response = `${this.statusEmoji[data.status]} 디스크 상태 분석 결과:\n\n`;
        if (analysis.threshold) {
            const serversAboveThreshold = data.details.filter(d => d.usage > analysis.threshold);
            response += `임계값 ${analysis.threshold}% 이상 사용 중인 서버: ${serversAboveThreshold.length}대\n\n`;
        }
        response += `전체 평균: ${data.average.toFixed(1)}%\n`;
        response += `최고 사용량: ${data.highest.toFixed(1)}%\n`;
        response += `최저 사용량: ${data.lowest.toFixed(1)}%\n\n`;
        if (data.highUsageServers.length > 0) {
            response += `높은 사용량 서버:\n`;
            data.highUsageServers.forEach(server => {
                response += `- ${server.name}: ${server.usage.toFixed(1)}%\n`;
            });
        }
        return response;
    }

    formatNetworkResponse(data, analysis) {
        let response = `${this.statusEmoji[data.status]} 네트워크 상태 분석 결과:\n\n`;
        if (analysis.threshold) {
            const serversAboveThreshold = data.details.filter(d => d.traffic > analysis.threshold);
            response += `임계값 ${analysis.threshold}% 이상 사용 중인 서버: ${serversAboveThreshold.length}대\n\n`;
        }
        response += `전체 평균: ${(data.average / 1024 / 1024).toFixed(2)} MB/s\n`;
        response += `최고 트래픽: ${(data.highest / 1024 / 1024).toFixed(2)} MB/s\n`;
        response += `최저 트래픽: ${(data.lowest / 1024 / 1024).toFixed(2)} MB/s\n\n`;
        if (data.highTrafficServers.length > 0) {
            response += `높은 트래픽 서버:\n`;
            data.highTrafficServers.forEach(server => {
                response += `- ${server.name}: ${(server.traffic / 1024 / 1024).toFixed(2)} MB/s\n`;
            });
        }
        return response;
    }

    formatPerformanceResponse(data, analysis) {
        let response = `${this.statusEmoji[data.status]} 전체 성능 분석 결과:\n\n`;
        response += `CPU 상태 ${this.statusEmoji[data.cpu.status]}:\n`;
        response += `- 평균 사용량: ${data.cpu.average.toFixed(1)}%\n\n`;
        response += `메모리 상태 ${this.statusEmoji[data.memory.status]}:\n`;
        response += `- 평균 사용량: ${data.memory.average.toFixed(1)}%\n\n`;
        response += `디스크 상태 ${this.statusEmoji[data.disk.status]}:\n`;
        response += `- 평균 사용량: ${data.disk.average.toFixed(1)}%\n\n`;
        response += `네트워크 상태 ${this.statusEmoji[data.network.status]}:\n`;
        response += `- 평균 트래픽: ${(data.network.average / 1024 / 1024).toFixed(2)} MB/s\n`;
        return response;
    }

    formatErrorResponse(data, analysis) {
        if (data.count === 0) {
            return `${this.statusEmoji[data.status]} 현재 발생한 오류가 없습니다.`;
        }
        let response = `${this.statusEmoji[data.status]} 오류 분석 결과:\n\n`;
        response += `전체 오류 수: ${data.count}\n`;
        if (data.criticalCount > 0) {
            response += `심각한 오류 수: ${data.criticalCount}\n`;
        }
        response += '\n';
        data.details.forEach(server => {
            response += `${server.name}:\n`;
            server.errors.forEach(error => {
                const isCritical = error.toLowerCase().includes('critical') || error.toLowerCase().includes('fatal');
                response += `${isCritical ? '🚨' : '⚠️'} ${error}\n`;
            });
            response += '\n';
        });
        return response;
    }
}

// 전역 인스턴스 생성
window.aiProcessor = new AIProcessor();

// 쿼리 처리 함수
async function processQuery(query) {
    return await window.aiProcessor.processQuery(query);
} 