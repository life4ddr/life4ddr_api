// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from 'next'

type Data = {
  name: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  const { code } = req.cookies;

  console.log(code);

  const response = await fetch(`https://life4ddr.com/oauth/me?access_token=${code}`)

  res.status(200).json(await response.json())
}
