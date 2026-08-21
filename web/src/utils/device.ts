/**
 * Utility helper to manage device identity and generate a persistent Virtual MAC address.
 */

export function getDeviceMac(): string {
  const STORAGE_KEY = 'rcplayer_device_mac';
  let mac = localStorage.getItem(STORAGE_KEY);

  if (!mac) {
    // Generate a simulated MAC address: "RC:XX:XX:XX:XX:XX"
    // Using hex characters to resemble a real hardware interface.
    const chars = '0123456789ABCDEF';
    const parts = ['RC']; // Branding prefix to identify virtual MACs
    
    for (let i = 0; i < 5; i++) {
      let part = '';
      part += chars[Math.floor(Math.random() * 16)];
      part += chars[Math.floor(Math.random() * 16)];
      parts.push(part);
    }
    
    mac = parts.join(':');
    localStorage.setItem(STORAGE_KEY, mac);
  }

  return mac;
}

export function getDeviceName(): string {
  // Try to parse user agent or device type
  const ua = navigator.userAgent;
  if (/smart-tv|smarttv|tizen|webos|opera tv|appletv/i.test(ua)) {
    return 'Smart TV';
  }
  if (/ipad|iphone|android/i.test(ua)) {
    return 'Mobile Device';
  }
  return 'Browser Desktop';
}
