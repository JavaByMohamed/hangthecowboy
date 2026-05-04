const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

const logDir = path.join(__dirname, 'logs');
const logFile = path.join(logDir, 'ips.txt');

if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
}

if (!fs.existsSync(logFile)) {
    fs.writeFileSync(logFile, '');
}

// Middleware to get real IP (important for deployment platforms)
app.set('trust proxy', true);

// Function to normalize IPv6-mapped IPv4 addresses
function normalizeIP(ip) {
    // Extract IPv4 from IPv6-mapped format (e.g., ::ffff:127.0.0.1 -> 127.0.0.1)
    if (ip.includes('::ffff:')) {
        return ip.replace('::ffff:', '');
    }
    return ip;
}

app.get('/', (req, res) => {
    const ip = normalizeIP(req.ip);
    const timestamp = new Date().toISOString();

    const logEntry = `${timestamp} - ${ip}\n`;

    const logFilePath = path.join(__dirname, 'logs', 'ips.txt');

    // Append IP to file
    fs.appendFile(logFilePath, logEntry, (err) => {
        if (err) {
            console.error('Error writing to log file:', err);
            return res.status(500).send('Error logging IP');
        }

        console.log('Logged:', logEntry.trim());
    });

    res.send('Well hello 👋 Your visit has been recorded, thanks for your visit!');
});

app.get('/logs', (req, res) => {
    const logFilePath = path.join(__dirname, 'logs', 'ips.txt');

    fs.readFile(logFilePath, 'utf8', (err, data) => {
        if (err) {
            return res.status(500).send('Could not read logs.');
        }

        const entries = data.trim().split('\n').filter(Boolean).reverse();

        const rows = entries.map(entry => {
            const [timestamp, ip] = entry.split(' - ');
            return `<tr><td>${timestamp}</td><td>${ip}</td></tr>`;
        }).join('');

        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Visitor Logs</title>
                <style>
                    body { font-family: sans-serif; padding: 30px; }
                    h1 { margin-bottom: 20px; }
                    table { border-collapse: collapse; width: 100%; }
                    th, td { border: 1px solid #ddd; padding: 10px 16px; text-align: left; }
                    th { background: #f4f4f4; }
                    tr:nth-child(even) { background: #fafafa; }
                </style>
            </head>
            <body>
                <h1>Visitor Logs</h1>
                <p>${entries.length} visit(s) recorded</p>
                <table>
                    <thead><tr><th>Timestamp</th><th>IP Address</th></tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </body>
            </html>
        `);
    });
});

const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

server.on('error', (err) => {
    console.error('Server error:', err);
    process.exit(1);
});
