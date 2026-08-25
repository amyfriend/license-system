const express = require("express");
const fs = require("fs");
const crypto = require("crypto");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const DATA_FILE = "./data/licenses.json";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

let adminToken = null;

// =========================
// DATA LICENSE
// =========================

function loadLicenses() {
    try {
        if (!fs.existsSync(DATA_FILE)) {
            fs.mkdirSync("./data", { recursive: true });

            const initialData = {
                licenses: []
            };

            fs.writeFileSync(
                DATA_FILE,
                JSON.stringify(initialData, null, 2)
            );

            return initialData;
        }

        const data = fs.readFileSync(DATA_FILE, "utf8");

        if (!data.trim()) {
            return { licenses: [] };
        }

        const parsed = JSON.parse(data);

        if (!Array.isArray(parsed.licenses)) {
            parsed.licenses = [];
        }

        return parsed;
    } catch (error) {
        console.error("Gagal membaca licenses.json:", error);
        return { licenses: [] };
    }
}

function saveLicenses(data) {
    fs.mkdirSync("./data", { recursive: true });

    fs.writeFileSync(
        DATA_FILE,
        JSON.stringify(data, null, 2)
    );
}

// =========================
// ADMIN AUTH
// =========================

function adminAuth(req, res, next) {
    const token = req.headers.authorization?.replace("Bearer ", "");

    if (!token || token !== adminToken) {
        return res.status(401).json({
            success: false,
            message: "Unauthorized"
        });
    }

    next();
}

// =========================
// HEALTH CHECK
// =========================

app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "License API aktif",
        status: "online"
    });
});

// =========================
// ADMIN LOGIN
// =========================

app.post("/admin/login", (req, res) => {
    const { password } = req.body;

    if (!password) {
        return res.status(400).json({
            success: false,
            message: "Password wajib diisi"
        });
    }

    if (password !== ADMIN_PASSWORD) {
        return res.status(401).json({
            success: false,
            message: "Password salah"
        });
    }

    adminToken = crypto.randomBytes(32).toString("hex");

    res.json({
        success: true,
        message: "Login admin berhasil",
        token: adminToken
    });
});

// =========================
// CREATE LICENSE
// =========================

app.post("/admin/license/create", adminAuth, (req, res) => {
    const { days } = req.body;

    const duration = Number(days);

    if (!duration || duration <= 0) {
        return res.status(400).json({
            success: false,
            message: "Jumlah hari tidak valid"
        });
    }

    const data = loadLicenses();

    const key =
        "LIC-" +
        crypto.randomBytes(4).toString("hex").toUpperCase() +
        "-" +
        crypto.randomBytes(4).toString("hex").toUpperCase();

    const now = new Date();
    const expires = new Date(
        now.getTime() + duration * 24 * 60 * 60 * 1000
    );

    const license = {
        key: key,
        status: "active",
        days: duration,
        created_at: now.toISOString(),
        expires_at: expires.toISOString(),
        device_id: null
    };

    data.licenses.push(license);

    saveLicenses(data);

    res.json({
        success: true,
        message: "License berhasil dibuat",
        license: license
    });
});

// =========================
// VERIFY LICENSE
// =========================

app.post("/license/verify", (req, res) => {
    const { key, device_id } = req.body;

    if (!key) {
        return res.status(400).json({
            success: false,
            message: "License key wajib diisi"
        });
    }

    if (!device_id) {
        return res.status(400).json({
            success: false,
            message: "Device ID wajib diisi"
        });
    }

    const data = loadLicenses();

    const license = data.licenses.find(
        item => item.key === key
    );

    if (!license) {
        return res.status(404).json({
            success: false,
            message: "License tidak ditemukan"
        });
    }

    // =========================
    // CHECK STATUS
    // =========================

    if (license.status !== "active") {
        return res.status(403).json({
            success: false,
            message: "License tidak aktif",
            license: {
                key: license.key,
                status: license.status,
                expires_at: license.expires_at,
                device_id: license.device_id
            }
        });
    }

    // =========================
    // CHECK EXPIRED
    // =========================

    const now = new Date();
    const expiresAt = new Date(license.expires_at);

    if (now >= expiresAt) {
        license.status = "expired";

        saveLicenses(data);

        return res.status(403).json({
            success: false,
            message: "License sudah expired",
            license: {
                key: license.key,
                status: license.status,
                expires_at: license.expires_at,
                device_id: license.device_id
            }
        });
    }

    // =========================
    // DEVICE BINDING
    // =========================

    if (!license.device_id) {
        license.device_id = device_id;

        saveLicenses(data);

        return res.json({
            success: true,
            message: "License berhasil diaktifkan pada device",
            license: {
                key: license.key,
                status: license.status,
                expires_at: license.expires_at,
                device_id: license.device_id
            }
        });
    }

    // =========================
    // CHECK DEVICE
    // =========================

    if (license.device_id !== device_id) {
        return res.status(403).json({
            success: false,
            message: "License sudah terikat pada device lain",
            license: {
                key: license.key,
                status: license.status,
                expires_at: license.expires_at,
                device_id: license.device_id
            }
        });
    }

    // =========================
    // SUCCESS
    // =========================

    res.json({
        success: true,
        message: "License valid",
        license: {
            key: license.key,
            status: license.status,
            expires_at: license.expires_at,
            device_id: license.device_id
        }
    });
});

// =========================
// LIST LICENSE
// =========================

app.get("/admin/licenses", adminAuth, (req, res) => {
    const data = loadLicenses();

    res.json({
        success: true,
        total: data.licenses.length,
        licenses: data.licenses
    });
});

// =========================
// DELETE LICENSE
// =========================

app.delete("/admin/license/:key", adminAuth, (req, res) => {
    const { key } = req.params;

    const data = loadLicenses();

    const index = data.licenses.findIndex(
        item => item.key === key
    );

    if (index === -1) {
        return res.status(404).json({
            success: false,
            message: "License tidak ditemukan"
        });
    }

    data.licenses.splice(index, 1);

    saveLicenses(data);

    res.json({
        success: true,
        message: "License berhasil dihapus"
    });
});

// =========================
// START SERVER
// =========================

app.listen(PORT, () => {
    console.log(`License API berjalan di port ${PORT}`);
});
