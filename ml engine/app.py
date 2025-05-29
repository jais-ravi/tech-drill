from flask import Flask, request, jsonify
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

app = Flask(__name__)

@app.route('/')
def home():
    return "Resume Analyzer ML Engine is running."

@app.route('/match', methods=['POST'])
def match_endpoint():
    data = request.json
    jd_text = data.get("jd", "")
    resume_texts = data.get("resumes", [])

    if not jd_text or not resume_texts:
        return jsonify({"error": "Missing job description or resumes"}), 400

    docs = resume_texts + [jd_text]
    vectorizer = TfidfVectorizer(stop_words='english')
    tfidf_matrix = vectorizer.fit_transform(docs)
    jd_vec = tfidf_matrix[-1]

    results = []
    for i, resume_vec in enumerate(tfidf_matrix[:-1]):
        score = cosine_similarity(resume_vec, jd_vec)[0][0]
        score = min(score * 2.5, 1.0)
        suggestion = (
            "Highly Suggested" if score >= 0.7
            else "Suggested" if score >= 0.3
            else "Not Suggested"
        )
        results.append({
            "score": round(float(score), 2),
            "suggestion": suggestion
        })
    return jsonify({"scores": results})

if __name__ == '__main__':
    app.run(host="0.0.0.0", port=5000)