export const postCard = ({
  id,
  author = `Author ${id}`,
  handle = `user${id}`,
  text = `Post ${id}`,
  top = 0,
  replyingTo = "",
  extra = ""
}: {
  id: string;
  author?: string;
  handle?: string;
  text?: string;
  top?: number;
  replyingTo?: string;
  extra?: string;
}) => `
  <article data-testid="tweet" data-top="${top}" data-height="180">
    <div data-testid="User-Name"><span>${author}</span><span>@${handle}</span></div>
    <a href="/${handle}/status/${id}"><time datetime="2026-08-31T12:00:00.000Z"></time></a>
    ${replyingTo ? `<div>Replying to <span>${replyingTo}</span></div>` : ""}
    <div data-testid="tweetText">${text}</div>
    ${extra}
    <div role="group" aria-label="2 replies, 3 reposts, 5 likes, 7 bookmarks, 11 views">
      <button data-testid="reply" aria-label="2 Replies"></button>
      <button data-testid="retweet" aria-label="3 Reposts"></button>
      <button data-testid="like" aria-label="5 Likes"></button>
    </div>
  </article>`;

const quotedPost = `
  <div role="link" tabindex="0">
    <div data-testid="User-Name"><span>Quoted Author</span><span>@quoted</span></div>
    <a href="/quoted/status/900"><time datetime="2026-08-30T08:00:00.000Z"></time></a>
    <div data-testid="tweetText">Nested quote</div>
    <div data-testid="tweetPhoto"><img src="https://pbs.twimg.com/media/quoted.jpg" alt="Quoted image"></div>
  </div>`;

export const postsFixture = `
  <main><section data-testid="primaryColumn">
    ${postCard({
      id: "100",
      author: "Ada Example",
      handle: "ada_example",
      text: 'Hello <img alt=":wave:"> world',
      top: 40,
      extra: `
        <div data-testid="tweetPhoto"><img src="https://pbs.twimg.com/media/photo.jpg" alt="A safe photo"></div>
        <div data-testid="tweetPhoto" aria-label="GIF"><img src="https://pbs.twimg.com/tweet_video_thumb/clip.jpg" alt=""></div>
        <div data-testid="card.wrapper"><a href="https://example.test/story">Example story</a><img src="https://example.test/card.jpg"></div>
        ${quotedPost}`
    })}
    ${postCard({ id: "101", top: 260, replyingTo: "@ada_example", text: "A reply" })}
    ${postCard({ id: "102", top: 920, text: "Below the viewport" })}
  </section></main>`;

export const conversationFixture = `
  <main><section data-testid="primaryColumn">
    <div role="tab" aria-selected="true">Posts</div>
    <button>Most recent</button>
    ${postCard({ id: "199", top: 0, text: "Ancestor" })}
    ${postCard({ id: "200", top: 200, text: "Conversation subject" })}
    ${postCard({ id: "201", top: 400, replyingTo: "@user200", text: "First reply" })}
    <h2>Discover more</h2>
    ${postCard({ id: "202", top: 600, text: "Related post" })}
  </section></main>`;

export const virtualizedBatches = [
  [
    postCard({ id: "301", top: 20 }),
    postCard({ id: "302", top: 220, replyingTo: "@user301" })
  ],
  [
    postCard({ id: "302", top: 220, replyingTo: "@user301" }),
    postCard({ id: "303", top: 660 }),
    postCard({ id: "304", top: 860, replyingTo: "@user303" })
  ],
  [
    postCard({ id: "304", top: 860, replyingTo: "@user303" }),
    postCard({ id: "305", top: 1080 })
  ]
];

export const intentFixture = {
  text: "Ampersand & equals = hash # emoji 🚀\nsecond line",
  postId: "1234567890",
  postUrl: "https://x.com/intent/tweet?text=Ampersand+%26+equals+%3D+hash+%23+emoji+%F0%9F%9A%80%0Asecond+line",
  replyUrl: "https://x.com/intent/tweet?text=Ampersand+%26+equals+%3D+hash+%23+emoji+%F0%9F%9A%80%0Asecond+line&in_reply_to=1234567890"
};
