import express from "express";
import moment from "moment";
import { openai } from "./lib/openai";
import { twitterClient } from "./lib/twitter";

const app = express();
const port = process.env.PORT || 3333;

app.use(express.json());
app.use(express.raw({ type: "application/vnd.custom-type" }));
app.use(express.text({ type: "text/html" }));

app.get("/post", async (req, res) => {
  const { data } = await twitterClient.tweets.usersIdTweets("44196397", {
    exclude: ["replies", "retweets"],
    start_time: moment().subtract(1, "day").format(),
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
    res.status(200).json({
      tweet: topTweet,
      data: openAiData,
    });
  } else {
    return res.status(400).json("No tweets available today");
  }
});

app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}`);
});
