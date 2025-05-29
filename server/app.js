const express = require('express');
const multer = require('multer');
const axios = require('axios');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());
const upload = multer({ dest: 'uploads/' });

async function extractText(filePath, mimetype) {
  if (mimetype === 'application/pdf') {
    const data = await pdfParse(fs.readFileSync(filePath));
    return data.text;
  }
  if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const { value } = await mammoth.extractRawText({ path: filePath });
    return value;
  }
  if (mimetype === 'text/plain') {
    return fs.readFileSync(filePath, 'utf8');
  }
  throw new Error('Unsupported file type');
}

app.use(express.static(path.join(__dirname, 'public')));

app.post('/analyze', upload.fields([{ name: 'resumes' }, { name: 'jd', maxCount: 1 }]), async (req, res) => {
  try {
    let jdText = '';
    if (req.files['jd']) {
      const file = req.files['jd'][0];
      jdText = await extractText(file.path, file.mimetype);
      fs.unlinkSync(file.path);
    } else if (req.body.jd_text) {
      jdText = req.body.jd_text;
    } else {
      return res.status(400).json({ error: 'No job description provided.' });
    }

    const resumes = req.files['resumes'] || [];
    const resumeTexts = [];
    const resumeNames = [];
    for (const file of resumes) {
      resumeTexts.push(await extractText(file.path, file.mimetype));
      resumeNames.push(file.originalname);
      fs.unlinkSync(file.path);
    }

    // Call Flask ML engine
    const { data } = await axios.post('http://localhost:5000/match', {
      jd: jdText,
      resumes: resumeTexts
    });

    const results = resumeNames.map((name, i) => ({
      name,
      ...data.scores[i]
    }));

    res.json({ results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(8080, () => console.log('Node.js backend started on port 8080'));