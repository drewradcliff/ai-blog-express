import express from "express";
import moment from "moment";
import { PrismaClient } from "@prisma/client";
import { openai } from "./lib/openai";
import { twitterClient } from "./lib/twitter";

const app = express();
const port = process.env.PORT || 3333;

app.use(express.json());
app.use(express.raw({ type: "application/vnd.custom-type" }));
app.use(express.text({ type: "text/html" }));

const prisma = new PrismaClient();

app.get("/post", async (req, res) => {
  const { authorization } = req.headers;
  if (authorization !== `Bearer ${process.env.NEXT_API_KEY}`) {
    return res.status(401).json({ message: "Invalid token" });
  }

  try {
    const { data } = await twitterClient.tweets.usersIdTweets("44196397", {
      exclude: ["replies", "retweets"],
      start_time: moment().subtract(1, "week").format(),
      max_results: 100,
      "tweet.fields": ["public_metrics"],
    });

    if (data) {
      const topTweet = data?.reduce((prev, curr) =>
        prev.public_metrics!.like_count > curr.public_metrics!.like_count
          ? prev
          : curr
      );

      const { data: openAiData } = await openai.createCompletion({
        model: "text-davinci-003",
        prompt: `Write a blog post in html about '${topTweet?.text}' as if it was written by Elon Musk`,
        max_tokens: 2000,
        temperature: 0,
      });

      let title = "";
      const content = openAiData.choices[0].text?.replaceAll(
        /<h1>(.*?)<\/h1>/gm,
        (_, match) => {
          title = match;
          return "";
        }
      );

      await prisma.post.create({
        data: {
          title,
          content: content ?? "",
          tweetUrl: "https://twitter.com/elonmusk/status/" + topTweet.id,
        },
      });
      res.status(200).json({
        tweet: topTweet,
        data: openAiData,
      });
    } else {
      return res.status(500).json("No tweets available today");
    }
  } catch (err) {
    return res.status(500).send("Error generating post");
  }
});

app.get("/post/:id", async (req, res) => {
  const { authorization } = req.headers;
  if (authorization !== `Bearer ${process.env.NEXT_API_KEY}`) {
    return res.status(401).json({ message: "Invalid token" });
  }
  const { id } = req.params;
  try {
    const post = await prisma.post.findUnique({
      where: {
        id: Number(id),
      },
    });
    res.status(200).json(post);
  } catch (err) {
    res.status(500).json({ err, message: "Error getting post" });
  }
});

app.get("/posts", async (req, res) => {
  const { authorization } = req.headers;
  if (authorization !== `Bearer ${process.env.NEXT_API_KEY}`) {
    return res.status(401).json({ message: "Invalid token" });
  }
  try {
    const posts = await prisma.post.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.status(200).json(posts);
  } catch (err) {
    return res.status(500).send("Error getting posts");
  }
});

app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}`);
});
