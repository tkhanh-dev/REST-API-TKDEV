const fs = require('fs').promises;
const path = require('path');
const ApiError = require('../../apiError');

module.exports = {
  name: 'vdgirl',
  desc: 'Fetches video links from catbox.json',
  author: 'TKDEV',
  async onStart() {
    try {
      const data = await fs.readFile(path.join(__dirname, '../../catbox.json'));
      this.links = JSON.parse(data);
    } catch (error) {
      throw new ApiError(500, 'Failed to load video links', error.message);
    }
  },
  handler: (req, res) => {
    res.json({ status: true, links: this.links });
  }
};
