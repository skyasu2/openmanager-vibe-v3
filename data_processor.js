// data_processor.js

class ServerDataProcessor {
    constructor(data) {
        this.rawData = data || [];
        this.allServerHostnames = this.rawData.length > 0 ? [...new Set(this.rawData.map(item => item.serverHostname))] : [];
    }

    applyFilters(timeRangeHours = 24, serverTypeFilter = 'all', alertFilterValue = 'all', locationFilter = 'all') {
        let filteredData = this.rawData;
        if (filteredData.length === 0) return [];

        if (timeRangeHours && Number.isInteger(parseInt(timeRangeHours))) {
            const now = new Date(); // 현재 시간을 기준으로 필터링 (endDate 대신)
            const startTime = new Date(now);
            startTime.setHours(now.getHours() - parseInt(timeRangeHours));
            
            filteredData = filteredData.filter(item => {
                const itemTime = new Date(item.timestamp);
                return itemTime >= startTime && itemTime <= now; // 현재 시간까지
            });
        }

        if (serverTypeFilter && serverTypeFilter !== 'all') {
            filteredData = filteredData.filter(item => item.serverType === serverTypeFilter);
        }

        if (locationFilter && locationFilter !== 'all') {
            filteredData = filteredData.filter(item => item.location === locationFilter);
        }

        if (alertFilterValue && alertFilterValue !== 'all') {
            const severities = ['Critical', 'Error', 'Warning', 'Info'];
            if (severities.includes(alertFilterValue)) {
                filteredData = filteredData.filter(item =>
                    item.alerts && item.alerts.some(alert => alert.severity === alertFilterValue)
                );
            } else { 
                filteredData = filteredData.filter(item =>
                    item.alerts && item.alerts.some(alert => alert.type === alertFilterValue)
                );
            }
        }
        return filteredData;
    }

    getTopNServersByResource(dataToProcess, resourceType, N = 5) { // dataToProcess 파라미터 추가
        if (!dataToProcess || dataToProcess.length === 0) return [];

        const serverResourceUsage = {};
        const uniqueServersInFilteredData = [...new Set(dataToProcess.map(item => item.serverHostname))];

        uniqueServersInFilteredData.forEach(hostname => {
            const serverDataPoints = dataToProcess.filter(item => item.serverHostname === hostname);
            if (serverDataPoints.length > 0) {
                let totalUsage = 0;
                serverDataPoints.forEach(item => {
                    switch (resourceType) {
                        case 'cpu': totalUsage += item.stats.cpuUsage; break;
                        case 'memory': totalUsage += item.stats.memoryUsage; break;
                        case 'disk': totalUsage += item.stats.diskUsage; break;
                        case 'network': totalUsage += (item.stats.networkTrafficIn + item.stats.networkTrafficOut); break;
                        default: break;
                    }
                });
                
                const latestDataPoint = serverDataPoints.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
                let latestUsageValue;
                switch (resourceType) {
                    case 'cpu': latestUsageValue = latestDataPoint.stats.cpuUsage; break;
                    case 'memory': latestUsageValue = latestDataPoint.stats.memoryUsage; break;
                    case 'disk': latestUsageValue = latestDataPoint.stats.diskUsage; break;
                    case 'network': latestUsageValue = latestDataPoint.stats.networkTrafficOut + latestDataPoint.stats.networkTrafficIn; break;
                    default: latestUsageValue = 0;
                }

                serverResourceUsage[hostname] = {
                    name: hostname,
                    type: serverDataPoints[0].serverType,
                    location: serverDataPoints[0].location,
                    avgUsage: parseFloat((totalUsage / serverDataPoints.length).toFixed(1)),
                    latestUsage: latestUsageValue,
                    unit: (resourceType === 'network' ? 'Mbps' : '%')
                };
            }
        });

        return Object.values(serverResourceUsage)
            .sort((a, b) => b.avgUsage - a.avgUsage)
            .slice(0, N);
    }

    getProblematicServersSummary(filteredData, N = 5) {
        if (!filteredData || filteredData.length === 0) return [];
        const serverProblemScore = {};
        const uniqueServersInFilteredData = [...new Set(filteredData.map(item => item.serverHostname))];

        uniqueServersInFilteredData.forEach(hostname => {
            const serverInfo = this.rawData.find(d => d.serverHostname === hostname); // rawData에서 기본 정보 가져오기
            serverProblemScore[hostname] = {
                name: hostname,
                type: serverInfo ? serverInfo.serverType : 'N/A',
                location: serverInfo ? serverInfo.location : 'N/A',
                criticalAlertCount: 0,
                errorAlertCount: 0,
                warningAlertCount: 0, 
                totalProblemDataPoints: 0,
                recentProblemMessages: new Set(),
                score: 0,
                lastStatus: 'Normal', // 초기값
                lastTimestamp: 0 // 초기값
            };
        });

        filteredData.forEach(item => {
            if (!serverProblemScore[item.serverHostname]) return;

             // 가장 최근 상태 업데이트
            const itemTimestamp = new Date(item.timestamp).getTime();
            if (itemTimestamp >= serverProblemScore[item.serverHostname].lastTimestamp) {
                serverProblemScore[item.serverHostname].lastStatus = item.status;
                serverProblemScore[item.serverHostname].lastTimestamp = itemTimestamp;
            }


            let pointHasProblem = false;
            if (item.status === 'Critical' || item.status === 'Error') {
                serverProblemScore[item.serverHostname].score += (item.status === 'Critical' ? 5 : 3);
                pointHasProblem = true;
            }

            (item.alerts || []).forEach(alert => {
                let alertScoreContribution = 0;
                if (alert.severity === 'Critical') {
                    serverProblemScore[item.serverHostname].criticalAlertCount++;
                    alertScoreContribution = 2;
                } else if (alert.severity === 'Error') {
                    serverProblemScore[item.serverHostname].errorAlertCount++;
                    alertScoreContribution = 1.5;
                } else if (alert.severity === 'Warning') {
                    serverProblemScore[item.serverHostname].warningAlertCount++;
                    alertScoreContribution = 0.5;
                }
                if(alertScoreContribution > 0) {
                    serverProblemScore[item.serverHostname].score += alertScoreContribution;
                    // 중복 방지를 위해 Set에 추가 후 Array로 변환 시 최근 것만 남기는 로직은 render 단에서 처리하거나, 여기서 더 정교하게 할 수 있음
                    serverProblemScore[item.serverHostname].recentProblemMessages.add(`[${alert.severity}] ${alert.type}: ${alert.message}`);
                    pointHasProblem = true;
                }
            });
            if(pointHasProblem) serverProblemScore[item.serverHostname].totalProblemDataPoints++;
        });

        return Object.values(serverProblemScore)
            .filter(s => s.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, N)
            .map(s => ({
                ...s,
                recentProblemMessages: Array.from(s.recentProblemMessages).slice(-2).join(' | ') // 최근 2개 메시지만 표시
            }));
    }
    
    getUniqueServerTypes() {
        return this.rawData.length > 0 ? [...new Set(this.rawData.map(item => item.serverType))].sort() : [];
    }

    getUniqueLocations() {
        return this.rawData.length > 0 ? [...new Set(this.rawData.map(item => item.location))].sort() : [];
    }

    getUniqueAlertTypes() {
        const alertTypes = new Set();
        if (this.rawData.length > 0) {
            this.rawData.forEach(item => {
                (item.alerts || []).forEach(alert => alertTypes.add(alert.type));
            });
        }
        return [...alertTypes].sort();
    }
}

if (typeof window !== 'undefined') {
    window.ServerDataProcessor = ServerDataProcessor;
}
