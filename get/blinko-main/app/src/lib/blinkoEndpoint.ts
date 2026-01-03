
// 桌面端默认后端地址
const DEFAULT_BLINKO_ENDPOINT = 'https://blinko-673807213796.asia-east1.run.app';

export function getBlinkoEndpoint(path: string = ''): string {
    try {
        const blinkoEndpoint = window.localStorage.getItem('blinkoEndpoint')
        const isTauri = !!(window as any).__TAURI__;
        
        if (isTauri) {
            // Tauri 环境：优先使用保存的地址，否则使用默认地址
            const endpoint = blinkoEndpoint?.replace(/"/g, '') || DEFAULT_BLINKO_ENDPOINT;
            try {
                const url = new URL(path, endpoint);
                return url.toString();
            } catch (error) {
                console.error(error);
                return new URL(path, DEFAULT_BLINKO_ENDPOINT).toString();
            }
        }

        return new URL(path, window.location.origin).toString();
    } catch (error) {
        console.error(error);
        return new URL(path, window.location.origin).toString();
    }
}

export function isTauriAndEndpointUndefined(): boolean {
    // 有默认值后，这个函数不再需要阻止登录
    return false;
}

export function saveBlinkoEndpoint(endpoint: string): void {
    if (endpoint) {
        window.localStorage.setItem('blinkoEndpoint', endpoint);
    }
}

export function getSavedEndpoint(): string {
    return window.localStorage.getItem('blinkoEndpoint') || DEFAULT_BLINKO_ENDPOINT;
}
