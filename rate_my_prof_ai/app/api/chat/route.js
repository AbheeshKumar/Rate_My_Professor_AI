import { NextResponse } from "next/server";
import { Pinecone } from "@pinecone-database/pinecone";
import {
  ChatGoogleGenerativeAI,
  GoogleGenerativeAIEmbeddings,
} from "@langchain/google-genai";
import {
  ChatPromptTemplate,
  SystemMessagePromptTemplate,
  HumanMessagePromptTemplate,
} from "@langchain/core/prompts";
import { marked } from "marked";

export async function POST(req) {
  const gemini_secret_key = process.env.NEXT_PUBLIC_GEMINI_API;
  const pinecone_secret_key = process.env.NEXT_PUBLIC_PINECONE_KEY;
  const data = await req.json();
  const pc = new Pinecone({
    apiKey: pinecone_secret_key,
  });
  const index = pc.Index("rag").namespace("nsl");

  const chat = new ChatGoogleGenerativeAI({
    apiKey: gemini_secret_key,
    model: "gemini-1.5-flash",
    maxOutputTokens: 1024,
    streaming: true,
  });
  const text = data[data.length - 1].content;
  const embedding = new GoogleGenerativeAIEmbeddings({
    apiKey: gemini_secret_key,
    model: "text-embedding-004",
  });

  const vectors = await embedding.embedQuery(text);
  const results = await index.query({
    vector: vectors,
    topK: 5,
    includeMetadata: true,
  });
  let resultString = "\nReturned Results from vector DB";
  results.matches.forEach((match) => {
    resultString += `
        Professor: ${match.id}
        Review: ${match.metadata.review}
        Subject: ${match.metadata.subject}
        Stars: ${match.metadata.stars}
        \n\n
    `;
  });

  const lastMessage = data[data.length - 1].content;
  // const lastMessageContent = lastMessage.content + resultString;
  const lastDataWithoutLastMessage = data.slice(0, data.length - 1);
  const systemPrompt = SystemMessagePromptTemplate.fromTemplate(
    `System Role: You are a smart assistant within the Rate My Professor app. Your task is to help users find the best professors based on their specific queries using Retrieval-Augmented Generation (RAG) and AI agents.

Capabilities:

RAG Integration: You have access to a knowledge base containing detailed information about professors, including their ratings, reviews, teaching style, subject expertise, and more.
Agent-Based Retrieval: For each user query, you deploy specialized agents to retrieve and rank the top 3 professors who best match the user criteria.
User Query Handling: You are capable of understanding nuanced queries that may include specific subjects, course levels, teaching methods, or other preferences.
User Queries: Users will ask questions like "Who are the best professors for machine learning?", "Which professors are highly rated for introductory courses?", or "Find professors who are known for their engaging lectures."

Response Format: For each user query, provide the top 3 professors, answer even if you require more data. listed with the following details:

Professor Name
Subject/Course Taught
Average Rating (0-5 stars)
Summary of Reviews: Highlight strengths, teaching style, and any notable comments from students.
Reason for Recommendation: Explain why this professor is a good match for the user query.
Constraints:

Ensure that the provided information is accurate, concise, and relevant to the user’s query.
If the query is too broad, ask the user for more specific details to better tailor the recommendations.
If there is insufficient data, clearly inform the user and suggest related alternatives.
Here is the data for the professors being evaluated: {profInfo} \n
Make your decision based on this data and user input, if sufficent information is provided then proceed with suggesting the professor.
Dont over evaluate and ask for unnecessary information. Keep your questions related to the context of data provided.
However, if user provides a link then scrape it and get the professor details in the same structure as specified. Do not potray professors from the data if a link is provided
If you have successfuly suggested 3 professors then do not ask for more information.
If you cant find 3 professors then thats okay. Do not inform user of 3 professors unless user specifically asks for a number of professors
`
  );

  const humanPrompt = HumanMessagePromptTemplate.fromTemplate(
    `
        {userLastQuery}
    `
  );

  const chatPrompt = ChatPromptTemplate.fromMessages([
    systemPrompt,
    ...lastDataWithoutLastMessage,
    humanPrompt,
  ]);

  let formattedPrompt = await chatPrompt.formatMessages({
    userLastQuery: lastMessage,
    profInfo: resultString,
    previousQueries: lastDataWithoutLastMessage,
  });

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        for await (const chunk of await chat.stream(formattedPrompt)) {
          const content = chunk.content;
          console.log("Content: ", content);
          if (content) {
            const text = encoder.encode(content);
            controller.enqueue(text);
          } else {
            console.log("Error", content);
          }
        }
      } catch (err) {
        controller.error(err);
      } finally {
        controller.close();
      }
    },
  });

  return new NextResponse(stream);
}
