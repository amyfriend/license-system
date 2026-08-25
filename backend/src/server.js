const express = require("express");
const fs = require("fs");
const crypto = require("crypto");

const app = express();
app.use(express.json());

const DATA_FILE = "./data/licenses.json";

function loadLicenses() {
    const data = fs.readFileSync(DATA_FILE, "utf8");
    return JSON.parse(data);
}

function saveLicenses(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function generateKey() {
    const part = () =>
        crypto.randomBytes(2).toString("hex").toUpperCase();

    return `${part()}-${part()}-${part()}-${part()}`;
}

// Test API
app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "License System API aktif"
    });
});

// Generate license
app.post("/api/licenses/generate", (req, res) => {
    const days = Number(req.body.days);

    if (!days || days < 1) {
        return res.status(400).json({
            success: false,
            message: "days harus berupa angka minimal 1"
        });
    }

    const data = loadLicenses();

    const now = new Date();
    const expires = new Date(now);
    expires.setDate(expires.getDate() + days);

    const license = {
        key: generateKey(),
        status: "active",
        created_at: now.toISOString(),
        expires_at: expires.toISOString(),
        device_id: null
    };

    data.licenses.push(license);
    saveLicenses(data);

    res.json({
        success: true,
        message: "License berhasil dibuat",
        license
    });
});

// Verify license
app.post("/api/licenses/verify", (req, res) => {
    const { license_key, device_id } = req.body;

    if (!license_key || !device_id) {
        return res.status(400).json({
            success: false,
            message: "license_key dan device_id wajib diisi"
        });
    }

        return res.status(403).json({
            success: false,
            message: "License sudah expired"
        });
    }

    // Bind device pertama kali
    if (!license.device_id) {
        license.device_id = device_id;
        saveLicenses(data);
    }

    // Cek device
    if (license.device_id !== device_id) {
        return res.status(403).json({
            success: false,
            message: "License sudah terikat ke device lain"
        });
    }

    // License valid
    return res.json({
        success: true,
        message: "License valid",
        expires_at: license.expires_at,
        device_id: license.device_id
    });
});

const PORT = process.env.SERVER_PORT || process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server berjalan di port ${PORT}`);
});
