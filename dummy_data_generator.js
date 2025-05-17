/**
 * OpenManager AI - 더미 데이터 생성기
 * 실시간 서버 모니터링을 위한 더미 데이터를 생성합니다.
 * 10분마다 자동 갱신되며, 약 30%의 확률로 에러 상태를 가진 서버를 생성합니다.
 */

class DummyDataGenerator {
    constructor() {
        this.serverCount = 50; // 100대에서 50대로 축소
        this.updateInterval = 10 * 60 * 1000; // 10분 (밀리초 단위)
        this.errorProbability = 0.3; // 30% 확률로 에러 발생
        this.serverPrefixes = ['web', 'app', 'db', 'cache', 'api', 'auth', 'cdn', 'monitor'];
        this.regions = ['kr', 'us', 'eu', 'jp', 'sg'];
        this.osTypes = ['Ubuntu 20.04 LTS', 'CentOS 7', 'Amazon Linux 2', 'Debian 11', 'RHEL 8'];
        this.services = ['nginx', 'mysql', 'redis', 'mongodb', 'elasticsearch', 'kafka', 'prometheus'];
        
        // 하루치 데이터 생성 시간 단위
        this.dayHours = 24;
        this.currentHour = 0;
        
        // 서버 데이터 초기화
        this.generateInitialData();
        
        // 전역 객체에 데이터 할당
        window.serverData = this.serverData;
        
        // 데이터 자동 업데이트 시작
        this.startDataUpdates();
    }
    
    // 초기 데이터 생성
    generateInitialData() {
        this.serverData = Array.from({ length: this.serverCount }, (_, i) => this.generateServer(i));
        this.dispatchUpdateEvent();
    }
    
    // 단일 서버 데이터 생성
    generateServer(index) {
        const prefix = this.getRandomItem(this.serverPrefixes);
        const region = this.getRandomItem(this.regions);
        const serverNumber = (index + 1).toString().padStart(3, '0');
        const hostname = `${prefix}-${region}-${serverNumber}`;
        
        // 리소스 사용량 (임의로 생성된 값)
        const cpu_usage = this.getRandomUsage(20, 95);
        const memory_total = this.getRandomInt(8, 64) * 1024 * 1024 * 1024; // 8GB ~ 64GB
        const memory_usage = Math.floor(memory_total * (this.getRandomUsage(10, 95) / 100));
        const memory_usage_percent = (memory_usage / memory_total) * 100;
        
        // 디스크 정보
        const disk = [{
            mount: '/',
            disk_total: this.getRandomInt(100, 1000) * 1024 * 1024 * 1024, // 100GB ~ 1TB
            disk_used: 0,
            disk_usage_percent: this.getRandomUsage(10, 95)
        }];
        
        // 디스크 사용량 계산
        disk[0].disk_used = Math.floor(disk[0].disk_total * (disk[0].disk_usage_percent / 100));
        
        // 네트워크 정보
        const net = {
            interface: 'eth0',
            rx_bytes: this.getRandomInt(10, 500) * 1024 * 1024, // 10MB ~ 500MB
            tx_bytes: this.getRandomInt(10, 500) * 1024 * 1024, // 10MB ~ 500MB
            rx_errors: this.getRandomInt(0, 50),
            tx_errors: this.getRandomInt(0, 50)
        };
        
        // 서비스 상태
        const services = {};
        const serviceCount = this.getRandomInt(3, 5);
        const selectedServices = this.getRandomItems(this.services, serviceCount);
        
        selectedServices.forEach(service => {
            // 30% 확률로 서비스 중단 (에러 상태)
            services[service] = Math.random() < this.errorProbability ? 'stopped' : 'running';
        });
        
        // 오류 메시지 (있을 경우)
        const errors = [];
        if (Math.random() < this.errorProbability) {
            const errorCount = this.getRandomInt(1, 3);
            for (let i = 0; i < errorCount; i++) {
                errors.push(this.generateErrorMessage());
            }
        }
        
        // 하루치 데이터 - 현재 시간 기준
        const now = new Date();
        now.setHours(this.currentHour, 0, 0, 0); // 현재 시간 설정 (하루 중 특정 시간)
        
        return {
            hostname,
            os: this.getRandomItem(this.osTypes),
            uptime: `${this.getRandomInt(1, 100)} days, ${this.getRandomInt(0, 23)} hours`,
            load_avg_1m: (Math.random() * 10).toFixed(2),
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
            timestamp: now.toISOString()
        };
    }
    
    // 데이터 업데이트 함수
    updateData() {
        // 하루 주기 업데이트
        this.currentHour = (this.currentHour + 1) % this.dayHours;
        
        this.serverData = this.serverData.map((server, index) => {
            // 서비스와 오류는 30% 확률로 재생성
            const shouldUpdateServices = Math.random() < 0.3;
            const shouldUpdateErrors = Math.random() < 0.3;
            
            // 리소스 사용량 업데이트 (변동폭 ±15%)
            const cpu_delta = this.getRandomInt(-15, 15);
            let cpu_usage = server.cpu_usage + cpu_delta;
            cpu_usage = Math.max(5, Math.min(98, cpu_usage)); // 5% ~ 98% 사이로 제한
            
            const memory_delta = this.getRandomInt(-15, 15);
            let memory_usage_percent = server.memory_usage_percent + memory_delta;
            memory_usage_percent = Math.max(5, Math.min(98, memory_usage_percent));
            const memory_usage = Math.floor(server.memory_total * (memory_usage_percent / 100));
            
            const disk_delta = this.getRandomInt(-10, 10);
            let disk_usage_percent = server.disk[0].disk_usage_percent + disk_delta;
            disk_usage_percent = Math.max(5, Math.min(98, disk_usage_percent));
            const disk_used = Math.floor(server.disk[0].disk_total * (disk_usage_percent / 100));
            
            // 네트워크 트래픽 업데이트
            const rx_bytes = server.net.rx_bytes + this.getRandomInt(-10, 20) * 1024 * 1024; // -10MB ~ +20MB
            const tx_bytes = server.net.tx_bytes + this.getRandomInt(-10, 20) * 1024 * 1024; // -10MB ~ +20MB
            
            // 서비스 상태 업데이트
            let services = { ...server.services };
            if (shouldUpdateServices) {
                Object.keys(services).forEach(service => {
                    services[service] = Math.random() < this.errorProbability ? 'stopped' : 'running';
                });
            }
            
            // 오류 메시지 업데이트
            let errors = [...server.errors];
            if (shouldUpdateErrors) {
                errors = [];
                if (Math.random() < this.errorProbability) {
                    const errorCount = this.getRandomInt(1, 3);
                    for (let i = 0; i < errorCount; i++) {
                        errors.push(this.generateErrorMessage());
                    }
                }
            }
            
            // 하루치 데이터 - 시간 업데이트
            const now = new Date();
            now.setHours(this.currentHour, 0, 0, 0);
            
            return {
                ...server,
                cpu_usage,
                memory_usage,
                memory_usage_percent,
                disk: [{
                    ...server.disk[0],
                    disk_used,
                    disk_usage_percent
                }],
                net: {
                    ...server.net,
                    rx_bytes: Math.max(0, rx_bytes),
                    tx_bytes: Math.max(0, tx_bytes)
                },
                services,
                errors,
                timestamp: now.toISOString()
            };
        });
        
        // 전역 객체에 업데이트된 데이터 할당
        window.serverData = this.serverData;
        
        // 이벤트 발생
        this.dispatchUpdateEvent();
    }
    
    // 데이터 업데이트 이벤트 발생
    dispatchUpdateEvent() {
        const event = new CustomEvent('serverDataUpdated', { detail: this.serverData });
        window.dispatchEvent(event);
    }
    
    // 데이터 업데이트 시작
    startDataUpdates() {
        // 초기 데이터 업데이트
        setTimeout(() => this.updateData(), 5000); // 5초 후 첫 업데이트
        
        // 주기적 업데이트 설정
        setInterval(() => this.updateData(), this.updateInterval);
    }
    
    // 유틸리티 함수
    getRandomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1) + min);
    }
    
    getRandomUsage(min, max) {
        return parseFloat((Math.random() * (max - min) + min).toFixed(1));
    }
    
    getRandomItem(array) {
        return array[Math.floor(Math.random() * array.length)];
    }
    
    getRandomItems(array, count) {
        const shuffled = [...array].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count);
    }
    
    generateErrorMessage() {
        const errorTypes = [
            'Connection refused',
            'Out of memory',
            'Process terminated',
            'Disk full',
            'Permission denied',
            'Timeout exceeded',
            'Resource temporarily unavailable',
            'Network unreachable',
            'Database connection failed'
        ];
        
        const errorSeverities = ['Warning', 'Error', 'Critical'];
        const services = ['nginx', 'mysql', 'redis', 'mongodb', 'elasticsearch', 'system', 'network'];
        
        const errorType = this.getRandomItem(errorTypes);
        const severity = this.getRandomItem(errorSeverities);
        const service = this.getRandomItem(services);
        
        return `[${severity}] ${service}: ${errorType}`;
    }
}

// 인스턴스 생성 및 초기화
const dummyDataGenerator = new DummyDataGenerator(); 