const fs = require('fs');
const path = require('path');

const meta = {
  name: "vdgirl",
  version: "1.0.0",
  description: "Random Video Girl with Link MP4",
  author: "TKDEV", 
  method: "get",
  category: "media",
  path: "/vdgirl"
};

async function onStart({ res }) {
  try {
    // Đọc danh sách link mp4 từ file JSON
    const filePath = path.join(__dirname, 'catbox.json');
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    if (!Array.isArray(data) || data.length === 0) {
      return res.status(500).json({ 
        status: false, 
        error: "No video links available." 
      });
    }

    // Random 1 link
    const randomLink = data[Math.floor(Math.random() * data.length)];

    return res.json({
      status: true,
      video: randomLink,
      timestamp: new Date().toISOString(),
      powered_by: "TKDEV"
    });

  } catch (err) {
    return res.status(500).json({ 
      status: false, 
      error: "Internal Server Error", 
      detail: err.message 
    });
  }
}

module.exports = { meta, onStart };
