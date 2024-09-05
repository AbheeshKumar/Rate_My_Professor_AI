"use client";
import Image from "next/image";
import styles from "./page.module.css";
import { useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  Modal,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { marked } from "marked";
import axios from "axios";
import Loading from "./component/loading";

export default function Home() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Hi! I a the rate my professor assistant. How can I help you today?",
    },
  ]);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isFlaskLoading, setIsFlaskLoading] = useState(false);
  const [url, setUrl] = useState("");
  const [res, setRes] = useState("");
  const [open, setOpen] = useState(false);
  const messageEndRef = useRef();

  const sendMessage = async () => {
    setMessage("");
    setMessages((messages) => [
      ...messages,
      { role: "user", content: message },
      { role: "assistant", content: "" },
    ]);

    const response = await fetch("api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify([...messages, { role: "user", content: message }]),
    })
      .then(async (res) => {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        let result = "";
        return reader.read().then(function processText({ done, value }) {
          if (done) {
            return result;
          }
          const text = decoder.decode(value || new Uint8Array(), {
            stream: true,
          });

          setMessages((messages) => {
            let lastMessage = messages[messages.length - 1];
            let otherMessages = messages.slice(0, messages.length - 1);
            return [
              ...otherMessages,
              { ...lastMessage, content: lastMessage.content + text },
            ];
          });
          return reader.read().then(processText);
        });
      })
      .catch((err) => {
        console.error(err);
      });
    setIsLoading(false);
  };

  const sendUrl = async (e) => {
    e.preventDefault();
    setIsFlaskLoading(true);
    try {
      const response = await axios.post("http://localhost:5000/scrape", {
        url,
      });
      setRes(response);
      setIsFlaskLoading(false);
      handleOpen();
    } catch (err) {
      console.error("Error Scraping URL: ", url);
    }
  };

  const handleOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  useEffect(() => {
    const lastMessage = messages[messages.length - 1];

    if (
      lastMessage.role == "assistant" &&
      lastMessage.content !=
        "Hi! I a the rate my professor assistant. How can I help you today?" &&
      lastMessage.content.length > 0
    ) {
      const formattedContent = marked(lastMessage.content);
      const updatedMessages = [
        ...messages.slice(0, messages.length - 1),
        { ...lastMessage, content: formattedContent },
      ];
      setMessages(updatedMessages);
    }
  }, [!isLoading]);

  useEffect(() => {
    messageEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <Box
      width="100vw"
      position="relative"
      height="100vh"
      display="flex"
      flexDirection="column"
      justifyContent="center"
      sx={{ opacity: isFlaskLoading ? 0.5 : 1 }}
      alignItems="center"
    >
      <Stack
        flexDirection="row"
        justifyContent="center"
        width="500px"
        alignItems="center"
        gap={4}
        mb={4}
      >
        <TextField
          label="Enter rate my professor url"
          fullWidth
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <Button variant="contained" onClick={sendUrl}>
          Fetch
        </Button>
      </Stack>
      <Stack
        direction="column"
        width="500px"
        height="700px"
        border="1px solid black"
        borderRadius={4}
        padding={2}
        spacing={2}
      >
        <Stack
          direction="column"
          spacing={2}
          flexGrow={1}
          overflow="auto"
          maxHeight="100%"
        >
          {messages.map((message, index) => (
            <Box
              key={index}
              display="flex"
              justifyContent={
                message.role == "assistant" ? "flex-start" : "flex-end"
              }
            >
              <Box
                bgcolor={
                  message.role == "assistant"
                    ? "primary.main"
                    : "secondary.main"
                }
                color="white"
                borderRadius={4}
                px={3}
                py={2}
                ref={messageEndRef}
                dangerouslySetInnerHTML={{ __html: message.content }}
              ></Box>
            </Box>
          ))}
        </Stack>
        <Stack direction="row" spacing={2}>
          <TextField
            label="Message"
            fullWidth
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <Button
            variant="contained"
            onClick={() => {
              setIsLoading(true);
              sendMessage();
            }}
          >
            Send
          </Button>
        </Stack>
      </Stack>
      {isFlaskLoading && <Loading message="Fetching data from Flask..." />}
      <Modal open={open} onClose={handleClose}>
        <Box
          position="absolute"
          top="30%"
          left="40%"
          width="400px"
          sx={{ opacity: 1 }}
          borderColor="2px solid #000"
          boxShadow={24}
          p={4}
        >
          <Typography variant="h6" component="h2">
            The professor's data has been successfully inserted. You can
          </Typography>
          <Typography sx={{ mt: 2 }}>
            proceed to interact with the AI about the professor
          </Typography>
        </Box>
      </Modal>
    </Box>
  );
}
