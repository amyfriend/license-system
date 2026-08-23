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

    const data = loadLicenses();

    const license = data.licenses.find(
        item => item.key === license_key
    );

    if (!license) {
        return res.status(404).json({
            success: false,
            message: "License tidak ditemukan"
        });
    }

    if (license.status !== "active") {
        return res.status(403).json({
            success: false,
            message: `License ${license.status}`
        });
    }

    if (new Date() > new Date(license.expires_at)) {
        license.status = "expired";
        saveLicenses(data);

        return res.status(403).json({
            success: false,
            message: "License sudah expired"
        });
    }

    // Bind device saat pertama kali digunakan
    if (license.device_id === null) {
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

    res.json({
        success: true,
        message: "License valid",
        expires_at: license.expires_at
    });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server berjalan di port ${PORT}`);
});
