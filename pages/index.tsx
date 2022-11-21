import { GetServerSideProps } from 'next';
import { useCallback, useEffect, useState } from 'react';

export default function Home() {
  const [posts, setPosts] = useState([]);
  
  const getPosts = useCallback(async () => {
    const response = await fetch("/api/hello");

    setPosts(await response.json());
  }, []);

  useEffect(() => {
    getPosts();
  }, [getPosts]);

  return <><ul>{posts.map(post => <li key={post.id}>{post.title.rendered}</li>)}</ul><a href="https://life4ddr.com/oauth/authorize?response_type=token&client_id=I4miBiR6IGChRNlYKmH01ERQNARgz27k4JGtPmxp&redirect_uri=http://localhost:3001">Login</a></>;
}

export const getServerSideProps: GetServerSideProps = async ({ query, res }) => {
  if (query.code) {
    const response = await fetch("https://life4ddr.com/oauth/token", { headers: {      'Content-Type': 'application/x-www-form-urlencoded'
  }, method: "POST", body: new URLSearchParams({
      grant_type: "authorization_code",
      code: query.code as string,
      client_id: "I4miBiR6IGChRNlYKmH01ERQNARgz27k4JGtPmxp",
      client_secret: "QHwUi6wOjfLAyaeRRoCN5zY6JCg1LmhhJs30ZQQV",
      redirect_uri: "/",
    }) })
    const json = await response.json();
    console.log(json);
    res.setHeader('Set-Cookie', [`access_token=${json.access_token}; Secure; HttpOnly`, `refresh_token=${json.refresh_token}; Secure; HttpOnly`]);
  }

  return {props:{}};
}
