// fixed_dummy_data.js (장애 상황 대폭 강화 및 분산 버전)

function getFixedDummyData() {
    const servers = [];
    // (서버 이름 생성 로직은 이전 답변과 동일하게 유지 - 다채로운 호스트 이름)
    const environments = ['prod', 'stg', 'dev'];
    const rolesByType = {
        WEB: ['nginx', 'apache', 'lb'], WAS: ['tomcat', 'node', 'spring'],
        DB: ['mysql-master', 'mysql-slave', 'pgsql'], BATCH: ['worker', 'scheduler'],
        MONITORING: ['prometheus', 'grafana'], SEARCH: ['elasticsearch'],
        API: ['gateway', 'authsvc', 'ordersvc', 'paymentsvc'], CACHE: ['redis', 'memcached']
    };
    const serverTypes = Object.keys(rolesByType);
    const locations = ['Seoul-IDC', 'Busan-IDC', 'US-West-Oregon', 'EU-Frankfurt', 'APAC-Singapore'];

    for (let i = 0; i < 30; i++) {
        const env = environments[i % environments.length];
        const serverType = serverTypes[Math.floor(i / environments.length) % serverTypes.length];
        const roleArray = rolesByType[serverType];
        const role = roleArray[i % roleArray.length];
        const instanceNum = Math.floor(i / (environments.length * serverTypes.length)) + 1;
        const hostname = `${env}-${serverType.toLowerCase()}-${role}-${String(instanceNum).padStart(2, '0')}.opm-cloud.com`;
        servers.push({
            serverHostname: hostname,
            ip: `10.${i % 8}.${Math.floor(i / 8)}.${(i % 50) + 10}`,
            serverType: serverType,
            location: locations[i % locations.length]
        });
    }

    const data = [];
    const baseEndDate = new Date(); 
    const startDate = new Date(baseEndDate);
    startDate.setHours(baseEndDate.getHours() - 24); 

    let currentTime = new Date(startDate);

    const alertPool = [ /* 이전 답변의 alertPool 사용, 필요시 메시지 구체화 */
        { type: 'CPU', severity: 'Critical', message: "CPU 사용률 95% 초과! 즉각 확인 필요.", keywords: ["cpu", "critical", "95%"] }, //0
        { type: 'CPU', severity: 'Warning', message: "CPU 부하 80% 이상 지속됨.", keywords: ["cpu", "warning", "80%"] }, //1
        { type: 'Memory', severity: 'Critical', message: "가용 메모리 100MB 미만! OOM 위험.", keywords: ["memory", "critical", "100MB"] }, //2
        { type: 'Memory', severity: 'Warning', message: "메모리 사용률 88% 이상 지속, 누수 의심.", keywords: ["memory", "warning", "88%", "누수"] }, //3
        { type: 'Disk', severity: 'Critical', message: "디스크 /data 파티션 사용률 98% 도달!", keywords: ["disk", "critical", "/data", "98%"] }, //4
        { type: 'Disk', severity: 'Warning', message: "디스크 I/O 대기 시간 급증 (평균 600ms).", keywords: ["disk", "warning", "i/o", "600ms"] }, //5
        { type: 'Network', severity: 'Error', message: "Outbound 트래픽 800Mbps 초과, 비정상 패턴.", keywords: ["network", "error", "outbound", "800Mbps"] }, //6
        { type: 'Process', severity: 'Critical', message: "주요 결제 프로세스(PaymentGateway) 응답 없음.", keywords: ["process", "critical", "PaymentGateway", "응답없음"] }, //7
        { type: 'Security', severity: 'Critical', message: "다수 국가에서 Admin 계정 로그인 시도 발생!", keywords: ["security", "critical", "login", "admin", "다수 국가"] }, //8
        { type: 'Batch', severity: 'Error', message: "일일 정산 배치(BATCH_DAILY_SETTLE_01) 처리 실패. 원인: DB Timeout.", keywords: ["batch", "error", "실패", "BATCH_DAILY_SETTLE_01", "DB Timeout"] }, //9
        { type: 'Database', severity: 'Critical', message: "DB 연결 불가! (prod-db-pgsql-01) 모든 연결 사용 중 또는 다운 의심.", keywords: ["database", "critical", "prod-db-pgsql-01", "연결불가"] }, //10
        { type: 'Application', severity: 'Error', message: "사용자 인증 서비스(AuthService) 장애 발생. (503 Service Unavailable)", keywords: ["application", "error", "AuthService", "503"] }, //11
        { type: 'Process', severity: 'Warning', message: "Tomcat 프로세스 CPU 사용률 과다 (stg-was-tomcat-01)", keywords: ["process", "warning", "tomcat", "cpu"] } //12
    ];

    // --- 장애 시나리오: 30개 중 20개 이상이 최근 24시간 내 다양한 시간에 문제 발생 ---
    const criticalTimeConfig = [];
    const problematicServers = new Set(); // 중복 방지

    // 시나리오 1: 최근 0~1시간 사이 (5개 서버) - 가장 긴급한 상황
    for(let i=0; i<5; i++) {
        const serverIdx = i; // 0, 1, 2, 3, 4
        problematicServers.add(servers[serverIdx].serverHostname);
        criticalTimeConfig.push({ 
            startHourAgo: 1, endHourAgo: 0, serverHostname: servers[serverIdx].serverHostname,
            forcedStats: { cpuUsage: 90 + Math.random()*9, memoryUsage: 85 + Math.random()*10, status: 'Critical' }, 
            alerts: [alertPool[0], (Math.random() < 0.5 ? alertPool[2] : alertPool[7])] // CPU Critical + Memory Critical 또는 Process Critical
        });
    }

    // 시나리오 2: 최근 1~3시간 사이 (5개 서버) - 심각도 높은 Warning 또는 Error
     for(let i=0; i<5; i++) {
        const serverIdx = 5 + i; // 5, 6, 7, 8, 9
        problematicServers.add(servers[serverIdx].serverHostname);
        criticalTimeConfig.push({ 
            startHourAgo: 3, endHourAgo: 1, serverHostname: servers[serverIdx].serverHostname,
            forcedStats: { diskUsage: 85 + Math.random()*10, networkTrafficOut: 300 + Math.random()*100, status: 'Error' }, 
            alerts: [alertPool[5], alertPool[6]] // Disk Warning, Network Error
        });
    }
    
    // 시나리오 3: 최근 3~6시간 사이 (5개 서버) - 다양한 타입의 Warning/Error
    for(let i=0; i<5; i++) {
        const serverIdx = 10 + i; // 10, 11, 12, 13, 14
        problematicServers.add(servers[serverIdx].serverHostname);
        criticalTimeConfig.push({ 
            startHourAgo: 6, endHourAgo: 3, serverHostname: servers[serverIdx].serverHostname,
            forcedStats: { cpuUsage: 70 + Math.random()*15, memoryUsage: 75 + Math.random()*10 }, 
            alerts: [alertPool[1], alertPool[3], (servers[serverIdx].serverType === 'API' ? alertPool[11] : alertPool[8])] // CPU/Mem Warning + App 또는 Security
        });
    }

    // 시나리오 4: 최근 6~12시간 사이 (5개 서버) - 특정 타입 서버에 집중된 문제
    for(let i=0; i<5; i++) {
        const serverIdx = 15 + i; // 15, 16, 17, 18, 19
        problematicServers.add(servers[serverIdx].serverHostname);
        let scenarioAlerts = [];
        let forcedS = {};
        if (servers[serverIdx].serverType === 'DB') {
            forcedS = {diskUsage: 92, status: 'Critical'}; scenarioAlerts = [alertPool[4], alertPool[10]];
        } else if (servers[serverIdx].serverType === 'BATCH') {
            forcedS = {status: 'Error'}; scenarioAlerts = [alertPool[9]];
        } else {
            forcedS = {memoryUsage: 85, status: 'Warning'}; scenarioAlerts = [alertPool[3]];
        }
        criticalTimeConfig.push({ 
            startHourAgo: 12, endHourAgo: 6, serverHostname: servers[serverIdx].serverHostname,
            forcedStats: forcedS, alerts: scenarioAlerts
        });
    }
    
    // 시나리오 5: 나머지 서버 중 일부에도 가벼운 Warning 또는 Info를 최근 24시간 내 랜덤하게 발생 (20개 채우기)
    let warningServerCount = 0;
    for(let i = 0; i < servers.length && problematicServers.size < 22; i++) { // 최대 22개까지 문제 서버 확보
        if (!problematicServers.has(servers[i].serverHostname)) {
            problematicServers.add(servers[i].serverHostname);
            criticalTimeConfig.push({
                startHourAgo: 18 + Math.random()*6, endHourAgo: 12 + Math.random()*6, // 12~24시간 전 사이 랜덤 시간
                serverHostname: servers[i].serverHostname,
                forcedStats: { cpuUsage: 60 + Math.random()*20 }, // 약간 높은 CPU
                alerts: [alertPool[1]] // CPU Warning
            });
            warningServerCount++;
        }
    }
    console.log("총 문제 시나리오 주입 서버 수: " + problematicServers.size);


    while (currentTime <= baseEndDate) {
        servers.forEach((server) => {
            let cpu = 5 + Math.random() * 40; let mem = 10 + Math.random() * 45;
            let disk = Math.max(5, 10 + Math.random() * 55);
            let netOut = Math.floor(10 + Math.random() * 70); let netIn = Math.floor(5 + Math.random() * 50);
            let procCnt = 30 + Math.floor(Math.random() * 30) + (server.serverType === 'WAS' || server.serverType === 'BATCH' ? 15 : 0);
            
            let currentServerAlerts = [];
            let serverStatus = 'Normal';
            let serverHighestSeverityScore = 0;

            const hoursAgo = (baseEndDate.getTime() - currentTime.getTime()) / (1000 * 60 * 60);

            for (const config of criticalTimeConfig) {
                if (config.serverHostname === server.serverHostname && 
                    hoursAgo >= config.endHourAgo && hoursAgo < config.startHourAgo) {
                    
                    if (config.forcedStats) {
                        if(config.forcedStats.cpuUsage) cpu = Math.max(cpu, config.forcedStats.cpuUsage + Math.random()*5 - 2.5);
                        if(config.forcedStats.memoryUsage) mem = Math.max(mem, config.forcedStats.memoryUsage + Math.random()*5 - 2.5);
                        if(config.forcedStats.diskUsage) disk = Math.max(disk, config.forcedStats.diskUsage + Math.random()*3 - 1.5);
                        if(config.forcedStats.networkTrafficOut) netOut = Math.max(netOut, config.forcedStats.networkTrafficOut);
                        if(config.forcedStats.networkTrafficIn) netIn = Math.max(netIn, config.forcedStats.networkTrafficIn);
                        if(config.forcedStats.status) serverStatus = config.forcedStats.status;
                    }
                    if (config.alerts && Array.isArray(config.alerts)) {
                        config.alerts.forEach(alertTemplate => {
                            const alertToAdd = JSON.parse(JSON.stringify(alertTemplate));
                            alertToAdd.timestamp = currentTime.toISOString();
                            // 메시지 플레이스홀더 동적 치환 (예시)
                            if(alertToAdd.message && alertToAdd.message.includes("90%")) alertToAdd.message = alertToAdd.message.replace("90%", `${cpu.toFixed(1)}%`);
                            if(alertToAdd.message && alertToAdd.message.includes("75%")) alertToAdd.message = alertToAdd.message.replace("75%", `${cpu.toFixed(1)}%`);
                            // ... 기타 플레이스홀더 처리 ...
                            currentServerAlerts.push(alertToAdd);
                        });
                    }
                    // 시나리오에 해당되면 serverStatus 우선 적용, 아니면 경고 기반
                     if (serverStatus === 'Normal' && currentServerAlerts.some(al => al.severity === 'Critical')) serverStatus = 'Critical';
                     else if (serverStatus === 'Normal' && currentServerAlerts.some(al => al.severity === 'Error')) serverStatus = 'Error';
                     else if (serverStatus === 'Normal' && currentServerAlerts.some(al => al.severity === 'Warning')) serverStatus = 'Warning';
                    break; 
                }
            }
            
            cpu = Math.max(1, Math.min(99.9, parseFloat(cpu.toFixed(1))));
            mem = Math.max(1, Math.min(99.9, parseFloat(mem.toFixed(1))));
            disk = Math.max(1, Math.min(99.5, parseFloat(disk.toFixed(1))));

            const finalAlerts = []; /* ... (이전 답변의 finalAlerts 생성 로직과 동일) ... */
            const alertKeys = new Set();
            currentServerAlerts.forEach(al => { 
               const messagePart = (al.message && typeof al.message === 'string') ? al.message.substring(0,15) : 'no_message_part';
               const key = `${al.type}-${al.severity}-${messagePart}`; 
               if (!alertKeys.has(key)) {
                   finalAlerts.push(al);
                   alertKeys.add(key);
               }
            });
            
            // 서버 데이터 객체 생성 (상태는 나중에 설정)
            const serverData = {
                serverHostname: server.serverHostname, 
                ip: server.ip, 
                serverType: server.serverType, 
                location: server.location,
                timestamp: currentTime.toISOString(),
                stats: { 
                    cpuUsage: cpu, 
                    memoryUsage: mem, 
                    diskUsage: disk, 
                    networkTrafficIn: netIn, 
                    networkTrafficOut: netOut, 
                    processCount: procCnt 
                },
                status: serverStatus, // 시나리오에서 제공한 초기 상태
                alerts: finalAlerts
            };
            
            // 모든 서버 상태를 자원 사용률에 따라 재계산
            // window.getServerStatus 함수가 있으면 이를 이용하고, 없으면 자체 로직으로 계산
            if (window.getServerStatus) {
                // dataProcessor의 상태 판단 함수 호출을 위해 필드 매핑
                const processorReadyData = {
                    cpu_usage: cpu,
                    memory_usage_percent: mem,
                    disk: [{ disk_usage_percent: disk }],
                    errors: finalAlerts.filter(al => 
                        al.severity === 'Critical' || al.severity === 'Error' || al.severity === 'Warning'
                    ), // 오류 정보를 다시 상태 판단에 반영 (Warning 포함)
                    services: server.services || {} // 실제 서비스 상태 전달
                };
                // 모든 서버에 대해 getServerStatus 적용 (기존 상태 무시)
                serverData.status = window.getServerStatus(processorReadyData);
            } else {
                // 자체 로직으로 상태 결정 (기준: 90% 이상 심각, 70% 이상 경고)
                if (cpu >= 90 || mem >= 90 || disk >= 90) {
                    serverData.status = 'Critical';
                } else if (cpu >= 70 || mem >= 70 || disk >= 70) {
                    serverData.status = 'Warning';
                } else {
                    serverData.status = 'Normal';
                }
            }
            
            data.push(serverData);
        });
        currentTime.setMinutes(currentTime.getMinutes() + 10); 
    }
    console.log(`Total dummy data points created (last 24h, 10min interval): ${data.length}`);
    return data;
}
