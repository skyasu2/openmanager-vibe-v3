/**
 * OpenManager AI - 더미 데이터 생성기
 * 실시간 서버 모니터링을 위한 현실적인 더미 데이터를 생성합니다.
 * 
 * 주요 기능:
 * - 50대 서버에 대한 현실적인 모니터링 데이터 생성
 * - 10분마다 데이터 갱신 및 누적 저장 (24시간 이력 보관)
 * - 서버 유형별 특성에 따른 데이터 생성 (웹서버, DB서버, API서버 등)
 * - 약 14%의 서버가 경고 또는 심각 상태로 생성 (심각: 4%, 경고: 10%)
 */

class DummyDataGenerator {
    constructor() {
        this.serverCount = 50; // 50대 서버
        this.initialBatchSize = 10; // 첫 로딩시 10대만 우선 생성
        this.updateInterval = 10 * 60 * 1000; // 10분 (밀리초 단위)
        
        // 장애 확률 설정 (심각: 4%, 경고: 10%, 정상: 86%)
        this.criticalProbability = 0.04; // 심각 상태 확률 (약 2대)
        this.warningProbability = 0.10; // 경고 상태 확률 (약 5대)
        this.errorProbability = 0.15; // 서비스 장애 및 오류 메시지 발생 확률
        
        // 서버 구성 정보
        this.serverConfigurations = [
            // 웹 서버 (15대)
            { 
                prefix: 'web', 
                count: 15,
                cpu: { base: 40, variation: 15 }, // 기본 CPU 사용률 40% ± 15%
                memory: { base: 50, variation: 15 }, // 기본 메모리 사용률 50% ± 15%
                disk: { base: 45, variation: 10 }, // 기본 디스크 사용률 45% ± 10%
                services: ['nginx', 'php-fpm', 'varnish', 'haproxy'],
                serviceCount: { min: 2, max: 4 }
            },
            // 애플리케이션 서버 (10대)
            {
                prefix: 'app',
                count: 10,
                cpu: { base: 55, variation: 20 },
                memory: { base: 60, variation: 15 },
                disk: { base: 40, variation: 10 },
                services: ['tomcat', 'nodejs', 'pm2', 'supervisord', 'docker'],
                serviceCount: { min: 2, max: 5 }
            },
            // 데이터베이스 서버 (8대)
            {
                prefix: 'db',
                count: 8,
                cpu: { base: 45, variation: 15 },
                memory: { base: 70, variation: 15 },
                disk: { base: 65, variation: 15 },
                services: ['mysql', 'postgresql', 'mongodb', 'redis', 'elasticsearch'],
                serviceCount: { min: 1, max: 3 }
            },
            // 캐시 서버 (5대)
            {
                prefix: 'cache',
                count: 5,
                cpu: { base: 30, variation: 20 },
                memory: { base: 80, variation: 15 },
                disk: { base: 25, variation: 10 },
                services: ['redis', 'memcached', 'varnish'],
                serviceCount: { min: 1, max: 2 }
            },
            // API 서버 (7대)
            {
                prefix: 'api',
                count: 7,
                cpu: { base: 50, variation: 20 },
                memory: { base: 55, variation: 15 },
                disk: { base: 35, variation: 10 },
                services: ['nginx', 'nodejs', 'python', 'gunicorn', 'uwsgi'],
                serviceCount: { min: 2, max: 4 }
            },
            // 모니터링 서버 (5대)
            {
                prefix: 'monitor',
                count: 5,
                cpu: { base: 35, variation: 10 },
                memory: { base: 50, variation: 10 },
                disk: { base: 60, variation: 15 },
                services: ['prometheus', 'grafana', 'influxdb', 'telegraf', 'alertmanager'],
                serviceCount: { min: 2, max: 5 }
            }
        ];
        
        this.regions = ['kr', 'us', 'eu', 'jp', 'sg'];
        this.osTypes = [
            'Ubuntu 20.04 LTS', 
            'Ubuntu 22.04 LTS', 
            'CentOS 7', 
            'Rocky Linux 8', 
            'Amazon Linux 2', 
            'Debian 11',
            'RHEL 8'
        ];
        
        // 서버 시간 패턴 (일과 시간에 부하 증가)
        this.timePatterns = {
            dailyPattern: [
                // 0-23시간, 가중치(0-100)
                30, 20, 15, 10, 10, 15, // 0-5시 (새벽): 낮은 부하
                25, 40, 60, 70, 75, 80, // 6-11시 (오전): 점차 증가
                85, 90, 85, 80, 75, 70, // 12-17시 (오후): 피크 후 감소
                65, 60, 55, 50, 40, 35  // 18-23시 (저녁): 점차 감소
            ]
        };
        
        // 생성 상태
        this.isGenerating = false;
        this.generatedCount = 0;
        
        // 이력 데이터 저장 (서버별로 보관)
        this.historicalData = {}; // 서버명: [데이터 포인트들]
        this.maxHistoricalPoints = 144; // 24시간(10분 간격 = 6개/시간 * 24시간)
        
        // 하루치 데이터 생성 시간 단위
        this.dayHours = 24;
        this.currentHour = new Date().getHours(); // 현재 시간으로 초기화
        
        // 서버 데이터 초기화 - 첫 배치만 즉시 생성
        this.serverData = [];
        this.generateInitialBatch();
        
        // 데이터 자동 업데이트 시작
        this.startDataUpdates();
    }
    
    // 초기 서버 배치 데이터 생성 (빠른 로딩을 위해 일부만 생성)
    generateInitialBatch() {
        console.log(`초기 서버 데이터 ${this.initialBatchSize}개 생성 중...`);
        
        // 서버 구성에 맞게 배포
        this.serverData = [];
        let serverIndex = 0;
        
        // 먼저 초기 배치 크기만큼만 생성
        for (let i = 0; i < this.initialBatchSize && serverIndex < this.serverCount; i++) {
            const server = this.createServerByConfiguration(serverIndex);
            this.serverData.push(server);
            
            // 이력 데이터 초기화
            if (!this.historicalData[server.hostname]) {
                this.historicalData[server.hostname] = [];
            }
            this.historicalData[server.hostname].push({...server, timestamp: new Date().toISOString()});
            
            serverIndex++;
        }
        
        // 전역 객체에 데이터 할당
        window.serverData = this.serverData;
        
        // 이벤트 발생
        this.dispatchUpdateEvent();
        
        // 나머지 데이터 비동기적으로 생성
        this.generateRemainingServersAsync();
    }
    
    // 서버 구성에 맞게 서버 생성
    createServerByConfiguration(index) {
        // 총 개수를 확인해서 어떤 유형의 서버를 생성할지 결정
        let currentCount = 0;
        let selectedConfig = null;
        
        for (const config of this.serverConfigurations) {
            if (index < currentCount + config.count) {
                selectedConfig = config;
                break;
            }
            currentCount += config.count;
        }
        
        // 기본값 사용 (만약 모든 설정에 맞지 않을 경우)
        if (!selectedConfig) {
            selectedConfig = this.serverConfigurations[0];
        }
        
        // 선택된 구성으로 서버 생성
        const serverNumber = (index + 1).toString().padStart(3, '0');
        const region = this.getRandomItem(this.regions);
        const hostname = `${selectedConfig.prefix}-${region}-${serverNumber}`;
        
        // 서버 상태 결정 (심각, 경고, 정상)
        // 통합 로직으로 대체할 것이므로 여기서는 리소스 변동 값만 결정
        const rand = Math.random();
        const isCritical = rand < this.criticalProbability;
        const isWarning = !isCritical && rand < (this.criticalProbability + this.warningProbability);
        
        // 시간대별 부하 가중치 적용 (현재 시간 기준)
        const timeWeightMultiplier = this.timePatterns.dailyPattern[this.currentHour] / 100;
        
        // 서버 유형에 맞는 리소스 사용량 계산
        let cpuBase = selectedConfig.cpu.base + this.getRandomInt(-selectedConfig.cpu.variation, selectedConfig.cpu.variation);
        const cpuVariation = this.getRandomInt(-10, 10); // 기본 변동폭
        
        // 심각 상태 서버는 CPU, 메모리, 디스크 중 하나 이상이 90% 이상
        if (isCritical) {
            // 어떤 리소스가 심각 상태가 될지 랜덤하게 결정 (1: CPU, 2: 메모리, 3: 디스크, 4: 여러개)
            const criticalType = this.getRandomInt(1, 4);
            if (criticalType === 1 || criticalType === 4) {
                cpuBase = 90 + this.getRandomInt(0, 8); // CPU 90-98%
            }
        }
        // 경고 상태 서버는 CPU, 메모리, 디스크 중 하나 이상이 70-89%
        else if (isWarning) {
            // 어떤 리소스가 경고 상태가 될지 랜덤하게 결정 (1: CPU, 2: 메모리, 3: 디스크, 4: 여러개)
            const warningType = this.getRandomInt(1, 4);
            if (warningType === 1 || warningType === 4) {
                cpuBase = 70 + this.getRandomInt(0, 19); // CPU 70-89%
            }
        }
        
        const cpu_usage = parseFloat(Math.min(Math.max(Math.floor(cpuBase * timeWeightMultiplier) + cpuVariation, 5), 98).toFixed(2));
        
        let memoryBase = selectedConfig.memory.base + this.getRandomInt(-selectedConfig.memory.variation, selectedConfig.memory.variation);
        const memoryVariation = this.getRandomInt(-10, 10);
        
        // 심각 상태의 메모리 설정
        if (isCritical) {
            const criticalType = this.getRandomInt(1, 4);
            if (criticalType === 2 || criticalType === 4) {
                memoryBase = 90 + this.getRandomInt(0, 8); // 메모리 90-98%
            }
        }
        // 경고 상태의 메모리 설정
        else if (isWarning) {
            const warningType = this.getRandomInt(1, 4);
            if (warningType === 2 || warningType === 4) {
                memoryBase = 70 + this.getRandomInt(0, 19); // 메모리 70-89%
            }
        }
        
        const memory_usage_percent = parseFloat(Math.min(Math.max(Math.floor(memoryBase * timeWeightMultiplier) + memoryVariation, 5), 98).toFixed(2));
        
        let diskBase = selectedConfig.disk.base + this.getRandomInt(-selectedConfig.disk.variation, selectedConfig.disk.variation);
        const diskVariation = this.getRandomInt(-5, 5);
        
        // 심각 상태의 디스크 설정
        if (isCritical) {
            const criticalType = this.getRandomInt(1, 4);
            if (criticalType === 3 || criticalType === 4) {
                diskBase = 90 + this.getRandomInt(0, 8); // 디스크 90-98%
            }
        }
        // 경고 상태의 디스크 설정
        else if (isWarning) {
            const warningType = this.getRandomInt(1, 4);
            if (warningType === 3 || warningType === 4) {
                diskBase = 70 + this.getRandomInt(0, 19); // 디스크 70-89%
            }
        }
        
        const disk_usage_percent = parseFloat(Math.min(Math.max(Math.floor(diskBase * timeWeightMultiplier) + diskVariation, 5), 98).toFixed(2));
        
        // 서버 유형에 따른 메모리 크기 차별화
        let memorySize;
        if (selectedConfig.prefix === 'db' || selectedConfig.prefix === 'app') {
            memorySize = this.getRandomInt(16, 64) * 1024 * 1024 * 1024; // 16GB ~ 64GB
        } else if (selectedConfig.prefix === 'cache') {
            memorySize = this.getRandomInt(32, 128) * 1024 * 1024 * 1024; // 32GB ~ 128GB
        } else {
            memorySize = this.getRandomInt(8, 32) * 1024 * 1024 * 1024; // 8GB ~ 32GB
        }
        
        const memory_total = memorySize;
        const memory_usage = Math.floor(memory_total * (memory_usage_percent / 100));
        
        // 서버 유형에 따른 디스크 크기 차별화
        let diskSize;
        if (selectedConfig.prefix === 'db' || selectedConfig.prefix === 'monitor') {
            diskSize = this.getRandomInt(500, 2000) * 1024 * 1024 * 1024; // 500GB ~ 2TB
        } else if (selectedConfig.prefix === 'web' || selectedConfig.prefix === 'app') {
            diskSize = this.getRandomInt(200, 500) * 1024 * 1024 * 1024; // 200GB ~ 500GB
        } else {
            diskSize = this.getRandomInt(100, 300) * 1024 * 1024 * 1024; // 100GB ~ 300GB
        }
        
        const disk = [{
            mount: '/',
            disk_total: diskSize,
            disk_used: Math.floor(diskSize * (disk_usage_percent / 100)),
            disk_usage_percent: disk_usage_percent
        }];
        
        // 네트워크 트래픽 (서버 유형에 따라 차별화)
        let networkMultiplier;
        if (selectedConfig.prefix === 'web' || selectedConfig.prefix === 'api') {
            networkMultiplier = this.getRandomInt(20, 50); // 높은 트래픽
        } else if (selectedConfig.prefix === 'db') {
            networkMultiplier = this.getRandomInt(10, 30); // 중간 트래픽
        } else {
            networkMultiplier = this.getRandomInt(5, 15); // 낮은 트래픽
        }
        
        const net = {
            interface: 'eth0',
            rx_bytes: networkMultiplier * 1024 * 1024 * Math.random() * timeWeightMultiplier, // 트래픽 * 시간 가중치
            tx_bytes: networkMultiplier * 1024 * 1024 * Math.random() * timeWeightMultiplier,
            rx_errors: Math.random() < this.errorProbability ? this.getRandomInt(1, 100) : 0,
            tx_errors: Math.random() < this.errorProbability ? this.getRandomInt(1, 50) : 0
        };
        
        // 서비스 상태
        const services = {};
        const serviceCount = this.getRandomInt(
            selectedConfig.serviceCount.min, 
            selectedConfig.serviceCount.max
        );
        
        const selectedServices = this.getRandomItems(selectedConfig.services, serviceCount);
        selectedServices.forEach(service => {
            // 서비스 중단 확률 (심각/경고 상태와 연계)
            let stopProbability = this.errorProbability;
            if (isCritical) stopProbability = 0.4; // 심각 상태는 서비스 중단 확률 높음
            else if (isWarning) stopProbability = 0.2; // 경고 상태는 서비스 중단 확률 중간
            
            services[service] = Math.random() < stopProbability ? 'stopped' : 'running';
        });
        
        // 오류 메시지 (있을 경우)
        const errors = [];
        
        // 오류 메시지 발생 확률 (심각/경고 상태와 연계)
        let errorMsgProbability = this.errorProbability;
        if (isCritical) errorMsgProbability = 0.7; // 심각 상태는 오류 메시지 확률 높음
        else if (isWarning) errorMsgProbability = 0.4; // 경고 상태는 오류 메시지 확률 중간
        
        if (Math.random() < errorMsgProbability) {
            const errorCount = isCritical ? this.getRandomInt(2, 3) : this.getRandomInt(1, 2);
            for (let i = 0; i < errorCount; i++) {
                errors.push(this.generateErrorMessage(selectedConfig.prefix));
            }
        }
        
        // 서버 유형에 따른 가동시간 차별화
        let uptimeDays;
        if (Math.random() < 0.8) { // 80% 확률로 정상적인 가동시간
            uptimeDays = this.getRandomInt(5, 120); // 5일 ~ 120일
        } else {
            uptimeDays = this.getRandomInt(1, 4); // 최근 재부팅된 서버
        }
        
        // 현재 시간 기반 타임스탬프
        const now = new Date();
        
        return {
            hostname,
            os: this.getRandomItem(this.osTypes),
            uptime: `${uptimeDays} days, ${this.getRandomInt(0, 23)} hours`,
            load_avg_1m: parseFloat((cpu_usage / 100 * this.getRandomInt(80, 120) / 100).toFixed(2)),
            process_count: this.getRandomInt(100, 500),
            zombie_count: Math.random() < 0.2 ? this.getRandomInt(1, 5) : 0,
            cpu_usage,
            memory_total,
            memory_usage,
            memory_usage_percent,
            disk,
            net,
            services,
            errors,
            timestamp: now.toISOString(),
            server_type: selectedConfig.prefix
        };
    }
    
    // 나머지 서버 데이터를 비동기적으로 생성
    generateRemainingServersAsync() {
        if (this.isGenerating) return;
        
        this.isGenerating = true;
        this.generatedCount = this.initialBatchSize;
        
        const batchSize = 5; // 한 번에 5개씩 생성
        const generateBatch = () => {
            const remainingCount = this.serverCount - this.generatedCount;
            
            if (remainingCount <= 0) {
                console.log(`모든 서버 데이터 ${this.serverCount}개 생성 완료`);
                this.isGenerating = false;
                return;
            }
            
            const batchCount = Math.min(batchSize, remainingCount);
            console.log(`서버 데이터 생성 중... (${this.generatedCount}/${this.serverCount})`);
            
            // 배치 생성
            const newServers = [];
            for (let i = 0; i < batchCount; i++) {
                const server = this.createServerByConfiguration(this.generatedCount + i);
                newServers.push(server);
                
                // 이력 데이터 초기화
                if (!this.historicalData[server.hostname]) {
                    this.historicalData[server.hostname] = [];
                }
                this.historicalData[server.hostname].push({...server, timestamp: new Date().toISOString()});
            }
            
            // 기존 데이터에 추가
            this.serverData = [...this.serverData, ...newServers];
            this.generatedCount += batchCount;
            
            // 전역 객체 업데이트
            window.serverData = this.serverData;
            
            // 이벤트 발생
            this.dispatchUpdateEvent();
            
            // 다음 배치 예약 (약간의 딜레이를 두어 UI 차단 방지)
            setTimeout(generateBatch, 50);
        };
        
        // 첫 배치 생성 시작
        setTimeout(generateBatch, 200);
    }
    
    // 데이터 업데이트 함수
    updateData() {
        // 하루 주기 업데이트
        this.currentHour = (this.currentHour + 1) % this.dayHours;
        
        // 모든 데이터가 생성되지 않았으면 업데이트 스킵
        if (this.isGenerating) {
            console.log("아직 모든 서버 데이터가 생성되지 않았습니다. 업데이트 스킵");
            return;
        }
        
        console.log(`서버 데이터 업데이트 중... (${this.serverData.length}개)`);
        
        // 현재 시간대의 가중치 계산
        const timeWeightMultiplier = this.timePatterns.dailyPattern[this.currentHour] / 100;
        
        // 새 타임스탬프 생성
        const now = new Date();
        now.setHours(this.currentHour, 0, 0, 0);
        
        // 전체 서버에서 심각 상태와 경고 상태의 개수를 추적
        let criticalCount = 0;
        let warningCount = 0;
        
        this.serverData = this.serverData.map((server, index) => {
            const serverType = server.hostname.split('-')[0];
            const config = this.serverConfigurations.find(c => c.prefix === serverType) || this.serverConfigurations[0];
            
            // 서비스와 오류는 30% 확률로 재생성
            const shouldUpdateServices = Math.random() < 0.3;
            const shouldUpdateErrors = Math.random() < 0.3;
            
            // 서버 상태 결정 (기존 상태를 고려하여 급격한 변화 방지)
            const isCritical = server.cpu_usage >= 90 || server.memory_usage_percent >= 90 || server.disk[0].disk_usage_percent >= 90;
            const isWarning = !isCritical && (server.cpu_usage >= 70 || server.memory_usage_percent >= 70 || server.disk[0].disk_usage_percent >= 70);
            
            // 심각/경고 상태 서버 수 추적
            if (isCritical) criticalCount++;
            else if (isWarning) warningCount++;
            
            // 상태 변화 확률 계산 (현재 상태에 따라 다르게 설정)
            let changeToCritical = false;
            let changeToWarning = false;
            let changeToNormal = false;
            
            // 상태 전이 확률 계산
            if (isCritical) {
                // 심각 → 정상 또는 경고 (20% 확률로 상태 변경)
                if (Math.random() < 0.2) {
                    changeToNormal = Math.random() < 0.5;
                    changeToWarning = !changeToNormal;
                }
            } 
            else if (isWarning) {
                // 경고 → 정상 또는 심각 (30% 확률로 상태 변경)
                if (Math.random() < 0.3) {
                    changeToNormal = Math.random() < 0.7; // 70% 확률로 정상으로 복구
                    changeToCritical = !changeToNormal; // 30% 확률로 심각으로 악화
                }
            }
            else {
                // 정상 → 경고 또는 심각 
                // 전체 심각/경고 상태 서버 수에 따라 확률 조정
                const targetCritical = Math.floor(this.serverData.length * this.criticalProbability);
                const targetWarning = Math.floor(this.serverData.length * this.warningProbability);
                
                // 심각 상태가 목표보다 적으면 심각 상태로 변경 확률 증가
                if (criticalCount < targetCritical && Math.random() < 0.05) {
                    changeToCritical = true;
                }
                // 경고 상태가 목표보다 적으면 경고 상태로 변경 확률 증가
                else if (warningCount < targetWarning && Math.random() < 0.1) {
                    changeToWarning = true;
                }
            }
            
            // 현재 상태를 가져오고 실제 업데이트 수행
            const cpu_base = config.cpu.base;
            const cpu_variation = config.cpu.variation;
            
            // 기본 변동값 계산
            let baseChange = this.getRandomInt(-15, 15);
            
            // 시간 패턴을 고려한 변동
            const timeInfluence = cpu_base * (timeWeightMultiplier - 0.5) * 0.8; // -40% ~ +40% 변동 가능
            
            // 상태 변화에 따른 리소스 사용량 조정
            if (changeToCritical) {
                // 리소스 중 랜덤하게 하나를 심각 상태로 설정
                const resourceType = this.getRandomInt(1, 3);
                if (resourceType === 1) {
                    baseChange = Math.max(90 - server.cpu_usage, baseChange); // CPU를 90% 이상으로
                }
            }
            else if (changeToWarning) {
                // 리소스 중 랜덤하게 하나를 경고 상태로 설정
                const resourceType = this.getRandomInt(1, 3);
                if (resourceType === 1) {
                    baseChange = Math.max(70 - server.cpu_usage, baseChange); // CPU를 70% 이상으로
                }
            }
            else if (changeToNormal) {
                // 모든 리소스를 정상 범위로 조정
                if (server.cpu_usage >= 70) {
                    baseChange = -this.getRandomInt(10, 30); // CPU 사용량 크게 감소
                }
            }
            
            // 최종 CPU 변동값 계산
            let cpu_delta = parseFloat((baseChange + timeInfluence).toFixed(2));
            cpu_delta = Math.max(Math.min(cpu_delta, 20), -20); // 변동폭 제한
            
            // 새 CPU 사용량 계산
            let cpu_usage = parseFloat((server.cpu_usage + cpu_delta).toFixed(2));
            cpu_usage = Math.max(5, Math.min(98, cpu_usage)); // 5% ~ 98% 사이로 제한
            
            // 다른 리소스도 비슷한 패턴으로 업데이트
            let memory_delta = parseFloat((this.getRandomInt(-10, 10) + timeInfluence * 0.8).toFixed(2));
            
            // 상태 변화에 따른 메모리 사용량 조정
            if (changeToCritical) {
                const resourceType = this.getRandomInt(1, 3);
                if (resourceType === 2) {
                    memory_delta = Math.max(90 - server.memory_usage_percent, memory_delta); // 메모리를 90% 이상으로
                }
            }
            else if (changeToWarning) {
                const resourceType = this.getRandomInt(1, 3);
                if (resourceType === 2) {
                    memory_delta = Math.max(70 - server.memory_usage_percent, memory_delta); // 메모리를 70% 이상으로
                }
            }
            else if (changeToNormal) {
                if (server.memory_usage_percent >= 70) {
                    memory_delta = -this.getRandomInt(10, 30); // 메모리 사용량 크게 감소
                }
            }
            
            let memory_usage_percent = parseFloat((server.memory_usage_percent + memory_delta).toFixed(2));
            memory_usage_percent = Math.max(5, Math.min(98, memory_usage_percent));
            const memory_usage = Math.floor(server.memory_total * (memory_usage_percent / 100));
            
            let disk_delta = parseFloat((this.getRandomInt(-5, 7) + timeInfluence * 0.4).toFixed(2)); // 디스크는 천천히 증가 경향
            
            // 상태 변화에 따른 디스크 사용량 조정
            if (changeToCritical) {
                const resourceType = this.getRandomInt(1, 3);
                if (resourceType === 3) {
                    disk_delta = Math.max(90 - server.disk[0].disk_usage_percent, disk_delta); // 디스크를 90% 이상으로
                }
            }
            else if (changeToWarning) {
                const resourceType = this.getRandomInt(1, 3);
                if (resourceType === 3) {
                    disk_delta = Math.max(70 - server.disk[0].disk_usage_percent, disk_delta); // 디스크를 70% 이상으로
                }
            }
            else if (changeToNormal) {
                if (server.disk[0].disk_usage_percent >= 70) {
                    disk_delta = -this.getRandomInt(5, 20); // 디스크 사용량 감소
                }
            }
            
            let disk_usage_percent = parseFloat((server.disk[0].disk_usage_percent + disk_delta).toFixed(2));
            disk_usage_percent = Math.max(5, Math.min(98, disk_usage_percent));
            const disk_used = Math.floor(server.disk[0].disk_total * (disk_usage_percent / 100));
            
            // 네트워크 트래픽 업데이트 (시간대에 크게 영향 받음)
            const trafficMultiplier = serverType === 'web' || serverType === 'api' ? 2 : 1; // 웹/API 서버는 트래픽 변동 폭이 더 큼
            const rx_delta = this.getRandomInt(-10, 20) * 1024 * 1024 * timeWeightMultiplier * trafficMultiplier;
            const tx_delta = this.getRandomInt(-10, 20) * 1024 * 1024 * timeWeightMultiplier * trafficMultiplier;
            
            const rx_bytes = Math.max(1024 * 1024, server.net.rx_bytes + rx_delta); // 최소 1MB
            const tx_bytes = Math.max(1024 * 1024, server.net.tx_bytes + tx_delta); // 최소 1MB
            
            // 네트워크 오류 업데이트
            const rx_errors = shouldUpdateErrors && Math.random() < this.errorProbability ? 
                server.net.rx_errors + this.getRandomInt(0, 10) : 
                Math.max(0, server.net.rx_errors - this.getRandomInt(0, 5));
            
            const tx_errors = shouldUpdateErrors && Math.random() < this.errorProbability ? 
                server.net.tx_errors + this.getRandomInt(0, 5) : 
                Math.max(0, server.net.tx_errors - this.getRandomInt(0, 3));
            
            // 서비스 상태 업데이트
            let services = { ...server.services };
            if (shouldUpdateServices) {
                Object.keys(services).forEach(service => {
                    if (services[service] === 'stopped') {
                        // 중단된 서비스는 70% 확률로 복구
                        services[service] = Math.random() < 0.7 ? 'running' : 'stopped';
                    } else {
                        // 실행 중인 서비스는 20% 확률로 중단
                        services[service] = Math.random() < 0.2 ? 'stopped' : 'running';
                    }
                });
            }
            
            // 오류 메시지 업데이트
            let errors = [...server.errors];
            if (shouldUpdateErrors) {
                // 기존 오류 중 70%는 제거(해결됨)
                errors = errors.filter(() => Math.random() > 0.7);
                
                // 새 오류 추가
                if (Math.random() < this.errorProbability) {
                    const errorCount = this.getRandomInt(1, 2);
                    for (let i = 0; i < errorCount; i++) {
                        errors.push(this.generateErrorMessage(serverType));
                    }
                }
            }
            
            // 좀비 프로세스 업데이트
            const zombie_count = Math.random() < 0.1 ? this.getRandomInt(1, 6) : 0;
            
            // 업데이트된 서버 객체
            const updatedServer = {
                ...server,
                cpu_usage,
                load_avg_1m: parseFloat((cpu_usage / 100 * this.getRandomInt(80, 120) / 100).toFixed(2)),
                memory_usage,
                memory_usage_percent,
                disk: [{
                    ...server.disk[0],
                    disk_used,
                    disk_usage_percent
                }],
                net: {
                    ...server.net,
                    rx_bytes,
                    tx_bytes,
                    rx_errors,
                    tx_errors
                },
                services,
                errors,
                zombie_count,
                timestamp: now.toISOString()
            };
            
            // 이력 데이터에 추가
            if (!this.historicalData[server.hostname]) {
                this.historicalData[server.hostname] = [];
            }
            
            this.historicalData[server.hostname].push(updatedServer);
            
            // 최대 데이터 포인트 수 유지 (오래된 데이터 제거)
            if (this.historicalData[server.hostname].length > this.maxHistoricalPoints) {
                this.historicalData[server.hostname].shift();
            }
            
            return updatedServer;
        });
        
        // 전역 객체에 업데이트된 데이터 할당
        window.serverData = this.serverData;
        window.serverHistoricalData = this.historicalData; // 이력 데이터도 전역으로 제공
        
        // 이벤트 발생
        this.dispatchUpdateEvent();
    }
    
    // 데이터 업데이트 이벤트 발생
    dispatchUpdateEvent() {
        const event = new CustomEvent('serverDataUpdated', { detail: this.serverData });
        window.dispatchEvent(event);
        
        // 이력 데이터 업데이트 이벤트도 발생
        const historyEvent = new CustomEvent('serverHistoricalDataUpdated', { detail: this.historicalData });
        window.dispatchEvent(historyEvent);
    }
    
    // 데이터 업데이트 시작
    startDataUpdates() {
        // 초기 데이터 업데이트
        setTimeout(() => this.updateData(), 5000); // 5초 후 첫 업데이트
        
        // 주기적 업데이트 설정
        setInterval(() => this.updateData(), this.updateInterval);
    }
    
    // 서버 유형별 맞춤형 오류 메시지 생성
    generateErrorMessage(serverType) {
        // 공통 오류 유형
        const commonErrorTypes = [
            'Out of memory', 
            'Process terminated',
            'Permission denied',
            'Timeout exceeded',
            'Resource temporarily unavailable',
            'Configuration error'
        ];
        
        // 서버 유형별 특화 오류
        const serverSpecificErrors = {
            'web': [
                'Connection refused',
                'HTTP 500 Internal Server Error',
                'SSL certificate expired',
                'Web server restart required',
                'Virtual host configuration error'
            ],
            'app': [
                'Application crashed',
                'Memory leak detected',
                'Thread deadlock',
                'Unhandled exception',
                'Runtime dependency missing'
            ],
            'db': [
                'Database connection failed',
                'Deadlock detected',
                'Transaction log full',
                'Replication lag',
                'Table corruption detected'
            ],
            'cache': [
                'Cache eviction rate high',
                'Memory fragmentation',
                'Connection pool exhausted',
                'Cache miss rate high',
                'Inconsistent data detected'
            ],
            'api': [
                'Rate limit exceeded',
                'API response timeout',
                'Authentication failure',
                'Service dependency unavailable',
                'Invalid request format'
            ],
            'monitor': [
                'Metrics collection failed',
                'Alert delivery failed',
                'Dashboard rendering error',
                'Data retention policy exceeded',
                'Agent communication failure'
            ]
        };
        
        // 오류 타입 선택
        let errorTypes = [...commonErrorTypes];
        if (serverSpecificErrors[serverType]) {
            errorTypes = [...errorTypes, ...serverSpecificErrors[serverType]];
        }
        
        const errorSeverities = ['Warning', 'Error', 'Critical'];
        const services = serverType === 'db' ? 
            ['mysql', 'postgresql', 'mongodb', 'redis'] : 
            ['system', 'network', 'app', 'disk', 'cpu', 'memory'];
        
        const errorType = this.getRandomItem(errorTypes);
        const severity = this.getRandomItem(errorSeverities);
        const service = this.getRandomItem(services);
        
        return `[${severity}] ${service}: ${errorType}`;
    }
    
    // 유틸리티 함수
    getRandomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1) + min);
    }
    
    getRandomUsage(min, max) {
        return parseFloat((Math.random() * (max - min) + min).toFixed(2));
    }
    
    getRandomItem(array) {
        return array[Math.floor(Math.random() * array.length)];
    }
    
    getRandomItems(array, count) {
        const shuffled = [...array].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, Math.min(count, array.length));
    }
}

// 인스턴스 생성 및 초기화
const dummyDataGenerator = new DummyDataGenerator(); 