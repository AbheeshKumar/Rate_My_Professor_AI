from flask import Flask, request, jsonify
from flask_cors import CORS
from bs4 import BeautifulSoup
import requests
import json
import google.generativeai as genai
from dotenv import load_dotenv
import os

load_dotenv()
from pinecone import Pinecone

app = Flask(__name__)
CORS(app)


@app.route("/scrape", methods=["POST"])
def scrape():
    data = request.json
    url = data.get("url")

    if not url:
        return jsonify({"error": "url is required"}), 400

    page = requests.get(url)
    soup = BeautifulSoup(page.text, "lxml")
    prof_stars = round(
        float(soup.find("div", class_="RatingValue__Numerator-qw8sqy-2 liyUjw").text)
    )

    prof_name = soup.find("div", class_="NameTitle__Name-dowf0z-0 cfjPUG").text
    prof_course = soup.find(
        "a", class_="TeacherDepartment__StyledDepartmentLink-fl79e8-0 iMmVHb"
    ).text
    words = prof_course.split()
    prof_course = " ".join(words[:-1])
    prof_review = soup.find(
        "div", class_="Comments__StyledComments-dzzyvm-0 gRjWel"
    ).text

    new_entry = {
        "professor": prof_name,
        "subject": prof_course,
        "stars": prof_stars,
        "review": prof_review,
    }

    with open("../reviews.json", "r") as file:
        data = json.load(file)

    for review in data["reviews"]:
        if (
            review["professor"] == new_entry["professor"]
            and review["subject"] == new_entry["subject"]
        ):
            return jsonify({"message": "Professor already exists in database"}), 200

    data["reviews"].append(new_entry)

    with open("../reviews.json", "w") as file:
        json.dump(data, file, indent=4)

    genai.configure(api_key=os.getenv("NEXT_PUBLIC_GEMINI_API"))
    pc = Pinecone(api_key=os.getenv("NEXT_PUBLIC_PINECONE_KEY"))

    processedData = []

    for review in data["reviews"]:
        response = genai.embed_content(
            model="models/text-embedding-004", content=review["review"]
        )
        embedding = response["embedding"]
        processedData.append(
            {
                "values": embedding,
                "id": review["professor"],
                "metadata": {
                    "review": review["review"],
                    "subject": review["subject"],
                    "stars": review["stars"],
                },
            }
        )

    index = pc.Index("rag")
    index.upsert(vectors=processedData, namespace="nsl")

    return jsonify(new_entry), 200


if __name__ == "__main__":
    app.run(debug=True, port=5000)
