const path = require('path');
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');
const iconv = require('iconv-lite');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
// Serve static files
app.use(express.static(path.join(__dirname, '../client/dist')));

const dbConfig = {
    host: '0.0.0.0',
    user: 'root',
    password: '0.0.0.0',
    port: 3306,
    database: 'wealthwise'
};

let pool;
async function initDB() {
    pool = mysql.createPool(dbConfig);
    console.log('Database pool created');
}
initDB();

// --- Helper Functions ---

const getStockPrefix = (code) => {
    // 6开头为沪市
    if (code.startsWith('6')) return 'sh';
    // 0/3开头为深市，但基金可能是00开头
    if (code.startsWith('0') || code.startsWith('3')) return 'sz';
    // 4/8开头为北交所
    if (code.startsWith('4') || code.startsWith('8')) return 'bj';
    // 5开头基金通常是沪市ETF (51/58)
    if (code.startsWith('5')) return 'sh';
    // 1开头基金通常是深市ETF/LOF (15/16)
    if (code.startsWith('1')) return 'sz';

    return 'sh'; // Default fallback
};

// Map code to EastMoney secid
const getEastMoneySecId = (code) => {
    if (code.startsWith('6')) return `1.${code}`; // SH
    if (code.startsWith('0') || code.startsWith('3')) return `0.${code}`; // SZ
    if (code.startsWith('8') || code.startsWith('4')) return `0.${code}`; // BJ (Usually 0 for BJ in EM?) Let's check.
    // BJ is often 0.8xxxx or 0.4xxxx in EastMoney interface if listed under SZ/BJ connect, but standard is 0 for SZ/BJ, 1 for SH.
    return `0.${code}`;
};

// Fetch Real Market Data (East Money API)
const fetchMarketData = async (code, type = 'stock') => {
    try {
        if (type === 'stock') {
            // Switch to Tencent API because EastMoney is unstable in this environment
            // Tencent: http://qt.gtimg.cn/q=sh600519
            const prefix = getStockPrefix(code);
            const url = `http://qt.gtimg.cn/q=${prefix}${code}`;

            const response = await axios.get(url, { responseType: 'arraybuffer' });
            const str = iconv.decode(response.data, 'gbk');

            // Format: v_sh600519="1~Name~Code~Current~PreClose~Open~...~31(Change)~32(Change%)~..."
            const match = str.match(/="(.+)"/);
            if (!match) return { name: code, current_price: 0, change_percent: 0, daily_change: 0 };

            const parts = match[1].split('~');
            if (parts.length < 33) return { name: code, current_price: 0, change_percent: 0, daily_change: 0 };

            const name = parts[1];
            const current = parseFloat(parts[3]);
            const preClose = parseFloat(parts[4]);
            const changeAmount = parseFloat(parts[31]);
            const changePercent = parseFloat(parts[32]);

            return {
                name,
                current_price: current,
                change_percent: changePercent,
                daily_change: changeAmount
            };

        } else {
            // Fund (East Money Fund Valuation)
            // API: http://fundgz.1234567.com.cn/js/001186.js
            const url = `http://fundgz.1234567.com.cn/js/${code}.js`;
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': 'http://fund.eastmoney.com/',
                    'Accept': '*/*'
                },
                timeout: 5000
            });

            // Response: jsonpgz({"fundcode":"001186","name":"富国文体健康股票A","jzrq":"2023-10-27","dwjz":"2.1230","gsz":"2.1350","gszzl":"0.56","gztime":"2023-10-30 15:00"});
            const str = response.data;
            const jsonStr = str.match(/jsonpgz\((.*)\);/);

            if (!jsonStr || !jsonStr[1]) {
                // Fallback or data not found (e.g. closed fund or ETF treated as stock?)
                return { name: code, current_price: 0, change_percent: 0, daily_change: 0 };
            }

            const data = JSON.parse(jsonStr[1]);

            const current = parseFloat(data.gsz); // Estimated Value
            const changePercent = parseFloat(data.gszzl); // Estimated Growth Rate
            const preClose = parseFloat(data.dwjz); // Previous Net Value

            // Calculate change amount based on preClose and percent
            const changeAmount = preClose * (changePercent / 100);

            return {
                name: data.name,
                current_price: current,
                change_percent: changePercent,
                daily_change: changeAmount // Estimated daily change per unit
            };
        }

    } catch (err) {
        console.error(`Error fetching data for ${code}:`, err.message);
        return { name: code, current_price: 0, change_percent: 0, daily_change: 0 };
    }
};

// Search API (Sina Suggest - Keeping this as it's good for fuzzy search, or switch to EM?)
// Sina is fine for now, EM search API is also available but Sina is simple.
// Let's stick to Sina for search to minimize risk, unless user asked to change search too.
// User said "Fetch fund/stock real price and change... from EastMoney". Search wasn't explicitly forced to change.
const searchAsset = async (query) => {
    if (!query) return [];
    try {
        const url = `http://suggest3.sinajs.cn/suggest/type=&key=${encodeURIComponent(query)}`;
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        const str = iconv.decode(response.data, 'gbk');

        const match = str.match(/="(.+)"/);
        if (!match) return [];

        const items = match[1].split(';');
        return items.map(item => {
            const parts = item.split(',');
            const code = parts[2];
            const name = parts[4];
            let type = 'stock';
            if (parts[0].startsWith('of')) type = 'fund';

            return {
                code,
                name,
                type,
                market: parts[0].substring(0, 2)
            };
        }).slice(0, 10);

    } catch (err) {
        console.error('Search error:', err);
        return [];
    }
};

// Fetch Historical Data (Tencent & EastMoney for Funds)
// Period: day, week, month, m1, m5, m30, m60
const fetchHistory = async (code, period = 'day', count = 30) => {
    try {
        // --- 1. Try EastMoney Pingzhong Data (Best for Open-ended Funds) ---
        // We suspect it's a fund if it starts with 00, 01, etc. or if user context implies.
        // But since we don't have explicit type passed here usually, let's try a heuristic
        // or just try Tencent first, if empty, try EM.
        // Actually, explicit type is better. But let's check code pattern.
        // Pure OTC funds: 6 digits.

        const isLikelyFund = /^\d{6}$/.test(code);
        // Note: Stocks are also 6 digits. But let's try Tencent first as it's standard for stocks.

        const prefix = getStockPrefix(code);

        // Tencent Min API for Intraday (Time-Sharing)
        if (period === 'min') {
             // http://web.ifzq.gtimg.cn/appstock/app/minute/query?code=sh600519
             const url = `http://web.ifzq.gtimg.cn/appstock/app/minute/query?code=${prefix}${code}`;
             const response = await axios.get(url);
             const key = `${prefix}${code}`;
             const rawData = response.data?.data?.[key]?.data?.data;

             if (rawData && Array.isArray(rawData)) {
                 return rawData.map(item => {
                     const parts = item.split(' ');
                     return {
                         date: parts[0], // Time HHmm
                         close: parseFloat(parts[1]),
                         // volume: parseInt(parts[2])
                     };
                 });
             }
             // If Tencent Min failed, maybe it's an OTC fund. OTC funds don't have "Min" usually.
             return [];
        }

        // K-Line API (Tencent)
        const url = `http://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=${prefix}${code},${period},,,${count},qfq`;
        const response = await axios.get(url);

        const key = `${prefix}${code}`;
        const klineData = response.data?.data?.[key];

        let dataList = [];
        if (klineData) {
            // Check qfq keys first, then standard keys
            const qfqKey = `qfq${period}`;
            if (klineData[qfqKey]) dataList = klineData[qfqKey];
            else if (klineData[period]) dataList = klineData[period];
            else if (period === 'day' && klineData.day) dataList = klineData.day; // Fallbacks
            else if (period === 'week' && klineData.week) dataList = klineData.week;
            else if (period === 'month' && klineData.month) dataList = klineData.month;
        }

        if (dataList.length > 0) {
            return dataList.map(d => ({
                date: d[0],
                close: parseFloat(d[2]),
                open: parseFloat(d[1]),
                high: parseFloat(d[3]),
                low: parseFloat(d[4]),
            }));
        }

        // --- 2. Fallback to EastMoney Pingzhong (For OTC Funds) ---
        // Only if period is day/week/month (Pingzhong has day, we can simulate week/month)
        if (dataList.length === 0 && isLikelyFund) {
            try {
                // API: http://fund.eastmoney.com/pingzhongdata/000001.js
                // Contains Data_ACWorthTrend (Cumulative Net Value - Adjusted)
                const emUrl = `http://fund.eastmoney.com/pingzhongdata/${code}.js`;
                const emRes = await axios.get(emUrl);

                // Extract Data_ACWorthTrend = [[x, y, ...], ...]
                const match = emRes.data.match(/Data_ACWorthTrend\s*=\s*(\[.*?\]);/);
                if (match) {
                    const rawJson = JSON.parse(match[1]);
                    // rawJson is [[timestamp, value, ...], ...]
                    // Sort by date desc and take last 'count'
                    // Actually rawJson is usually ascending.
                    const recent = rawJson.slice(-count);

                    return recent.map(item => {
                        const dateObj = new Date(item[0]);
                        const dateStr = dateObj.toISOString().split('T')[0];
                        const val = parseFloat(item[1]);
                        return {
                            date: dateStr,
                            open: val,
                            close: val,
                            high: val,
                            low: val
                        };
                    });
                }
            } catch (e) {
                // Ignore EM error
            }
        }

        return [];
    } catch (err) {
        console.error('History fetch error:', err.message);
        return [];
    }
};


// --- APIs ---

// Login
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const [rows] = await pool.execute('SELECT * FROM users WHERE username = ? AND password_hash = ?', [username, password]);
        if (rows.length > 0) {
            res.json({
                success: true,
                user: {
                    id: rows[0].id,
                    username: rows[0].username,
                    nickname: rows[0].nickname,
                    avatar: rows[0].avatar
                }
            });
        } else {
            res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update User Profile
app.put('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    const { nickname, avatar, password, oldPassword } = req.body;

    try {
        // If updating password, verify old password first
        if (password) {
            if (!oldPassword) {
                return res.status(400).json({ message: '请输入当前密码' });
            }
            const [rows] = await pool.execute('SELECT password_hash FROM users WHERE id = ?', [id]);
            if (rows.length === 0) return res.status(404).json({ message: 'User not found' });

            if (rows[0].password_hash !== oldPassword) {
                return res.status(401).json({ message: '当前密码错误' });
            }
        }

        let query = 'UPDATE users SET nickname = ?, avatar = ?';
        let params = [nickname, avatar];

        if (password) {
            query += ', password_hash = ?';
            params.push(password);
        }

        query += ' WHERE id = ?';
        params.push(id);

        await pool.execute(query, params);

        // Return updated info
        const [updatedRows] = await pool.execute('SELECT * FROM users WHERE id = ?', [id]);
        if (updatedRows.length > 0) {
            res.json({
                success: true,
                user: {
                    id: updatedRows[0].id,
                    username: updatedRows[0].username,
                    nickname: updatedRows[0].nickname,
                    avatar: updatedRows[0].avatar
                }
            });
        } else {
             res.status(404).json({ error: 'User not found' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get User
app.get('/api/users/:id', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM users WHERE id = ?', [req.params.id]);
        if (rows.length > 0) {
             res.json({
                id: rows[0].id,
                username: rows[0].username,
                nickname: rows[0].nickname,
                avatar: rows[0].avatar
            });
        } else {
            res.status(404).json({ error: 'User not found' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get Historical Data (Detailed)
app.get('/api/history/detailed', async (req, res) => {
    const { code, period } = req.query;
    const data = await fetchHistory(code, period, 100); // 100 bars
    res.json(data);
});

// Get Platforms
app.get('/api/platforms', async (req, res) => {
    const userId = req.query.userId || 1;
    try {
        const [rows] = await pool.execute('SELECT * FROM platforms WHERE user_id = ?', [userId]);

        const platforms = await Promise.all(rows.map(async (p) => {
            // Get stocks
            const [stocks] = await pool.execute('SELECT * FROM assets_stock WHERE platform_id = ?', [p.id]);
            let stockValue = 0;
            for (const s of stocks) {
                const market = await fetchMarketData(s.stock_code, 'stock');
                stockValue += (market.current_price * s.quantity);
            }

            // Get funds
            const [funds] = await pool.execute('SELECT * FROM assets_fund WHERE platform_id = ?', [p.id]);
            let fundValue = 0;
            for (const f of funds) {
                const market = await fetchMarketData(f.fund_code, 'fund');
                // Fund logic: holding_amount is Value.
                // We update it by daily change % for display purposes of "Current Value".
                // Ideally, we should store shares. But sticking to schema:
                // New Value = Old Value * (1 + Change%/100)
                fundValue += parseFloat(f.holding_amount) * (1 + market.change_percent / 100);
            }

            return { ...p, total_value: stockValue + fundValue };
        }));
        res.json(platforms);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add Platform
app.post('/api/platforms', async (req, res) => {
    const { userId, name } = req.body;
    try {
        const [result] = await pool.execute('INSERT INTO platforms (user_id, name) VALUES (?, ?)', [userId, name]);
        res.json({ id: result.insertId, name });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete Platform
app.delete('/api/platforms/:id', async (req, res) => {
    try {
        const [stocks] = await pool.execute('SELECT count(*) as count FROM assets_stock WHERE platform_id = ?', [req.params.id]);
        const [funds] = await pool.execute('SELECT count(*) as count FROM assets_fund WHERE platform_id = ?', [req.params.id]);

        if (stocks[0].count > 0 || funds[0].count > 0) {
            return res.status(400).json({ error: '平台内尚有资产，无法删除' });
        }

        await pool.execute('DELETE FROM platforms WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get Stocks
app.get('/api/stocks', async (req, res) => {
    const userId = req.query.userId || 1;
    try {
        const [rows] = await pool.execute(`
            SELECT s.*, p.name as platform_name 
            FROM assets_stock s 
            JOIN platforms p ON s.platform_id = p.id 
            WHERE s.user_id = ?
        `, [userId]);

        const enriched = await Promise.all(rows.map(async (stock) => {
            const market = await fetchMarketData(stock.stock_code, 'stock');
            const currentMarketValue = stock.quantity * market.current_price;
            const costValue = stock.quantity * stock.cost_price;
            const totalPnL = currentMarketValue - costValue;
            const totalPnLPercent = costValue !== 0 ? (totalPnL / costValue) * 100 : 0;
            // Daily PnL = Quantity * Daily Change Amount (from API)
            const dailyPnL = stock.quantity * market.daily_change;

            return {
                ...stock,
                current_price: market.current_price,
                market_value: currentMarketValue,
                total_pnl: totalPnL,
                total_pnl_percent: totalPnLPercent,
                daily_pnl: dailyPnL,
                daily_percent: market.change_percent
            };
        }));
        res.json(enriched);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add Stock
app.post('/api/stocks', async (req, res) => {
    const { userId, platformId, code, name, quantity, cost } = req.body;
    try {
        await pool.execute(
            'INSERT INTO assets_stock (user_id, platform_id, stock_code, stock_name, quantity, cost_price) VALUES (?, ?, ?, ?, ?, ?)',
            [userId, platformId, code, name, quantity, cost]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete Stock
app.delete('/api/stocks/:id', async (req, res) => {
    try {
        await pool.execute('DELETE FROM assets_stock WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get Funds
app.get('/api/funds', async (req, res) => {
    const userId = req.query.userId || 1;
    try {
        const [rows] = await pool.execute(`
            SELECT f.*, p.name as platform_name 
            FROM assets_fund f 
            JOIN platforms p ON f.platform_id = p.id 
            WHERE f.user_id = ?
        `, [userId]);

        const enriched = await Promise.all(rows.map(async (fund) => {
            const market = await fetchMarketData(fund.fund_code, 'fund');

            // Logic: holding_amount is Current Value (from user input initially)
            // To get Real-time Value: Holding Amount * (1 + Change%)
            const currentMarketValue = parseFloat(fund.holding_amount) * (1 + market.change_percent / 100);

            // Total PnL = (Current Value - Cost). Cost = Holding Amount - Holding Return (from input)
            // This is messy because input was mixed.
            // Let's assume input `holding_amount` was "Money Invested" or "Value Yesterday"?
            // User: "Fund adds... Name, Holding Amount, Holding Return".
            // Let's assume `holding_amount` is CURRENT VALUE (snapshot when added).
            // Then `holding_return` is TOTAL RETURN so far.
            // Cost = Holding Amount - Holding Return.
            // New Total PnL = (New Current Value - Cost).

            const costValue = parseFloat(fund.holding_amount) - parseFloat(fund.holding_return);
            const totalPnL = currentMarketValue - costValue;
            const totalPnLPercent = costValue > 0 ? (totalPnL / costValue) * 100 : 0;

            // Daily PnL: Current Value * Change%
            // Note: `currentMarketValue` is today's value.
            // Base for daily change should be yesterday's value (which is approx `fund.holding_amount` if we assume it hasn't been updated today in DB).
            const dailyPnL = parseFloat(fund.holding_amount) * (market.change_percent / 100);

            return {
                ...fund,
                market_value: currentMarketValue,
                total_pnl: totalPnL,
                total_pnl_percent: totalPnLPercent,
                daily_pnl: dailyPnL,
                daily_percent: market.change_percent
            };
        }));
        res.json(enriched);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add Fund
app.post('/api/funds', async (req, res) => {
    const { userId, platformId, code, name, amount, ret } = req.body;
    try {
        await pool.execute(
            'INSERT INTO assets_fund (user_id, platform_id, fund_code, fund_name, holding_amount, holding_return) VALUES (?, ?, ?, ?, ?, ?)',
            [userId, platformId, code, name, amount, ret]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete Fund
app.delete('/api/funds/:id', async (req, res) => {
    try {
        await pool.execute('DELETE FROM assets_fund WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Watchlist APIs
app.get('/api/watchlist', async (req, res) => {
    const userId = req.query.userId || 1;
    try {
        const [rows] = await pool.execute('SELECT * FROM watchlist WHERE user_id = ?', [userId]);
        const enriched = await Promise.all(rows.map(async (item) => {
            const market = await fetchMarketData(item.code, item.type);
            // Fetch history for sparkline (last 10 days)
            const history = await fetchHistory(item.code, 10);
            return {
                ...item,
                current_price: market.current_price,
                change_percent: market.change_percent,
                chartData: history.map(h => h.close)
            };
        }));
        res.json(enriched);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/watchlist', async (req, res) => {
    const { userId, code, name, type } = req.body;
    try {
        await pool.execute(
            'INSERT INTO watchlist (user_id, type, code, name) VALUES (?, ?, ?, ?)',
            [userId, type, code, name]
        );
        res.json({ success: true });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
             res.status(400).json({ error: '已在关注列表中' });
        } else {
             res.status(500).json({ error: err.message });
        }
    }
});

app.delete('/api/watchlist/:id', async (req, res) => {
    try {
        await pool.execute('DELETE FROM watchlist WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Dashboard Stats
app.get('/api/dashboard', async (req, res) => {
    const userId = req.query.userId || 1;
    try {
        const [stocks] = await pool.execute('SELECT * FROM assets_stock WHERE user_id = ?', [userId]);
        const [funds] = await pool.execute('SELECT * FROM assets_fund WHERE user_id = ?', [userId]);

        let totalAsset = 0;
        let totalDailyPnL = 0;
        let totalAccumulatedPnL = 0;
        let initialCost = 0;

        // Process Stocks
        for (const s of stocks) {
            const market = await fetchMarketData(s.stock_code, 'stock');
            const val = s.quantity * market.current_price;
            const cost = s.quantity * s.cost_price;
            totalAsset += val;
            initialCost += cost;
            totalDailyPnL += s.quantity * market.daily_change;
            totalAccumulatedPnL += (val - cost);
        }

        // Process Funds
        for (const f of funds) {
            const market = await fetchMarketData(f.fund_code, 'fund');
            // Assuming holding_amount is yesterday's value (base for today's change)
            const baseValue = parseFloat(f.holding_amount);
            const currentVal = baseValue * (1 + market.change_percent / 100);

            const pnl = parseFloat(f.holding_return); // Accumulated before today
            // Correct logic: Total Accumulated PnL = (Current Value - Cost)
            const cost = baseValue - pnl;

            totalAsset += currentVal;
            initialCost += cost;
            totalDailyPnL += baseValue * (market.change_percent / 100);
            totalAccumulatedPnL += (currentVal - cost);
        }

        res.json({
            total_asset: totalAsset,
            daily_pnl: totalDailyPnL,
            total_pnl: totalAccumulatedPnL,
            total_pnl_percent: initialCost > 0 ? (totalAccumulatedPnL / initialCost) * 100 : 0
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Search API
app.get('/api/search', async (req, res) => {
    const { query } = req.query;
    const results = await searchAsset(query);
    res.json(results);
});

// Calendar PnL Data (Real Historical Data)
app.get('/api/calendar', async (req, res) => {
    const userId = req.query.userId || 1;
    try {
        const [stocks] = await pool.execute('SELECT * FROM assets_stock WHERE user_id = ?', [userId]);
        const dailyPnLs = {};

        for (const s of stocks) {
            const history = await fetchHistory(s.stock_code, 40);
            for (let i = 1; i < history.length; i++) {
                const day = history[i];
                const prevDay = history[i-1];
                const date = day.date;
                const dailyChange = day.close - prevDay.close;
                const pnl = dailyChange * s.quantity;

                if (!dailyPnLs[date]) dailyPnLs[date] = 0;
                dailyPnLs[date] += pnl;
            }
        }

        const result = Object.keys(dailyPnLs).map(date => ({
            date,
            value: parseFloat(dailyPnLs[date].toFixed(2))
        }));

        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Asset History (Simulated Trend)
app.get('/api/asset-history', async (req, res) => {
    const userId = req.query.userId || 1;
    try {
        const [stocks] = await pool.execute('SELECT * FROM assets_stock WHERE user_id = ?', [userId]);
        const [funds] = await pool.execute('SELECT * FROM assets_fund WHERE user_id = ?', [userId]);

        const dailyAssets = {}; // { '2023-10-01': 150000, ... }

        // Process Stocks History
        for (const s of stocks) {
            const history = await fetchHistory(s.stock_code, 30);
            for (const day of history) {
                if (!dailyAssets[day.date]) dailyAssets[day.date] = 0;
                dailyAssets[day.date] += (day.close * s.quantity);
            }
        }

        // Process Funds History (Simplified)
        const totalFundValue = funds.reduce((acc, f) => acc + parseFloat(f.holding_amount), 0);

        // Finalize
        const result = Object.keys(dailyAssets).sort().map(date => ({
            date,
            value: parseFloat((dailyAssets[date] + totalFundValue).toFixed(2))
        }));

        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Serve index.html for any other requests (Client Routing)
// Use regex for catch-all in newer Express
app.get(/.*/, (req, res) => {
    // Check if request is for API
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'API not found' });
    }
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
