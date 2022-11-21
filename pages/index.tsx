import { GetServerSideProps } from 'next';
import { useCallback, useEffect, useState } from 'react';

type HomeProps = { host: string | null };

export default function Home({ host }: HomeProps) {
  const [posts, setPosts] = useState<{
    id: number,
    title: {
      rendered: string;
    }
  }[]>([]);
  
  const getPosts = useCallback(async () => {
    const response = await fetch("/api/hello");

    setPosts(await response.json());
  }, []);

  useEffect(() => {
    getPosts();
  }, [getPosts]);

  return <><ul>{posts.map(post => <li key={post.id}>{post.title.rendered}</li>)}</ul><a href={`https://life4ddr.com/oauth/authorize?response_type=token&client_id=${process.env.NEXT_PUBLIC_LIFE4_OAUTH_CLIENT_ID}&redirect_uri=${host?.startsWith("localhost") ? "http://" : "https://"}${host}`}>Login</a></>;
}

export const getServerSideProps: GetServerSideProps = async ({ query, req, res }) => {
  if (query.code) {
    const response = await fetch("https://life4ddr.com/oauth/token", { headers: {      'Content-Type': 'application/x-www-form-urlencoded'
  }, method: "POST", body: new URLSearchParams({
      grant_type: "authorization_code",
      code: query.code as string,
      client_id: process.env.NEXT_PUBLIC_LIFE4_OAUTH_CLIENT_ID!,
      client_secret: process.env.LIFE4_OAUTH_CLIENT_SECRET!,
      redirect_uri: "/",
    }) })
    const json = await response.json();
    console.log(json);
    res.setHeader('Set-Cookie', [`access_token=${json.access_token}; Secure; HttpOnly`, `refresh_token=${json.refresh_token}; Secure; HttpOnly`]);
  }

  return {props:{
    host: req.headers.host,
  }};
}
