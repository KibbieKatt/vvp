# VRC Video Proxy

VVP is a Node.js application designed to proxy and cache video content for playback in VRChat. The goal of VVP is to improve the VRC media syncplay expereince with a focus on YouTube and self-hosted private media by providing a pre-packaged yt-dlp installation maximally configured out of the box to resist blocking and rate-limiting by YouTube.

## Features

* **Bleeding-edge yt-dlp**: [While VRC itself uses yt-dlp locally](https://help.vrchat.com/hc/en-us/articles/1500002378742-I-m-having-issues-with-video-players-in-VRChat) to power video players, this project configures some of yt-dlp's more advanced features to improve reliability
* **Bundled Deno for EJS**: VVP includes Deno out of the box for External JavaScript support, which works with yt-dlp to solve JavaScript challenges presented by YouTube
* **Pre-configured BgUtils POT Provider**: The BgUtils proof-of-origin token (POT) provider runs alongside yt-dlp and improves resistance to 403 errors and bot checks
* **Auto updates for critical components**: Yt-dlp and Bgutils are auto updated by dependabot and automatically tested to ensure the latest versions of each are available
* **In-memory Caching**: Eliminate the "is something supposed to be playing right now?" question - if it loads for 1 person it should load for all
* **Origin / Mime Allowlist**: Prevents VVP from being used to proxy unintended content
* **Batteries Included**: Single container setup requires minimal to no config out of the box

## Quick Start

1. Run the container

    ```yml
    services:
      vvp:
        image: ghcr.io/kibbiekatt/vvp:latest
        container_name: vvp
        restart: unless-stopped
        ports:
          - 3000:3000
        environment:
    #      - REFERER_URL=https://www.youtube.com/
    #      - ALLOWED_ORIGINS=https://*.googlevideo.com,https://jellyfin.example.com

    ```

2. Load a youtube video into a VRC video player using the proxy:

    `http://localhost:3000/watch?v=xxxxxxxxxxx`

    Or load any m3u8 url using the proxy:

    `http://localhost:3000/api/proxy?url=<urlencoded-url>`

3. Add your reverse proxy of choice to use with friends!

## Configuration

* `PORT`: Only needed when running outside of docker. Adjust to avoid conflicts.
* `YTDLP_BIN`: Set to override the binary VVP uses. Defaults to `yt-dlp`.
* `REFERER_URL`: Sets the referrer for proxied requests. This defaults to YouTube and currently can only be set globally for all requests.
* `ALLOWED_ORIGINS`: Sets the allowed domains VVP is allowed to proxy. Defaults to the domain used by YouTube.
  * Origins are matched using minimatch and should be in the format `https://foo.example.com`, or using wildcards, `https://*.example.com`.
  * This rule doesn't apply to special endpoints like `/watch`, but only the arbitrary url proxy at `/api/proxy`, which handles `.m3u8` and video segment URLs.
  * If playing personal media through VVP, add your media server domain to the list.
  * Adding `*` to the list will allow all domains to be proxied, provided the content meets the `ALLOWED_MIMES` rules. **Doing this is dangerous! Only your mime filter would prevent proxying anything on the internet! Only do this for debugging and brief testing!**
* `ALLOWED_MIMES`: Sets the allowed mime types that VVP will proxy to users. The default should include most mime types used by playlists and video files, as well as `application/octet-stream`, which YouTube uses for playlists. **Under no circumstances should you add `text/html` to this list, doing so would allow your server to be used as a web proxy!**

## Manual Deployment

When deploying manually, you must provide your own yt-dlp installation with ejs, deno, bgutil pot plugin, and bgutil pot server.

### Prerequisites

* yt-dlp
  * [yt-dlp-ejs](https://github.com/yt-dlp/ejs) (typically included with yt-dlp, [see ejs wiki](https://github.com/yt-dlp/yt-dlp/wiki/EJS#step-2-install-ejs-challenge-solver-scripts))
  * [deno](https://github.com/denoland/deno) (see [ejs wiki](https://github.com/yt-dlp/yt-dlp/wiki/EJS#step-1-install-a-supported-javascript-runtime) for alternative options)
  * [bgutil-yt-dlp-pot-provider](https://github.com/Brainicism/bgutil-ytdlp-pot-provider/tree/master?tab=readme-ov-file#2-install-the-plugin) (plugin)
* [bgutil-ytdlp-pot-provider](https://github.com/Brainicism/bgutil-ytdlp-pot-provider/tree/master?tab=readme-ov-file#1-set-up-the-provider) (server)
* Node.js
* yarn

### Steps

1. Clone the Repository

   ```bash
   git clone https://github.com/KibbieKatt/vvp.git
   cd vvp
   ```

2. Install Dependencies

   ```bash
   yarn install
   ```

3. Set Up Environment Variables

   Copy the `example.env` to `.env` in the root directory and adjust any desired settings from default:

     ```env
     PORT=3000
     ALLOWED_ORIGINS=https://*.googlevideo.com,https://jellyfin.example.com
     ```

4. Start the Server

   For development (with auto-restart):

     ```bash
     yarn dev
     ```

   For production:

     ```bash
     yarn start
     ```

5. Use the Proxy!

## Usage

### YouTube

Use the `/watch` endpoint anywhere a stream URL is accepted. Yt-dlp, bgutils, and ejs will try to give you the best chance of loading successfully.

* In VRC video players
* With MPV:

  ```bash
  mpv http://localhost:3000/watch?v=dQw4w9WgXcQ
  ```

### Generic Proxy

Proxy arbitratry `.m3u8` streams with the `/api/proxy` endpoint. Be sure to add the domain used for the `.m3u8` playlist as well as any domains contained in the playlists to `ALLOWED_ORIGINS`.

While this endpoint will proxy a video file, it doesn't support range requests, so it will download the source entirely before sending it to the client. For that reason, it's currently more suited towards `.m3u8` playlists and their smaller video chunks.

* Provide a urlencoded stream URL to the proxy endpoint:

  ```text
  http://localhost:3000/api/proxy?url=https%3A%2F%2Fexample.com%2Fstream%2Fplaylist.m3u8
  ```

* URLs should be urlencoded, for example with jq:

  ```bash
  echo "https://example.com/stream/playlist.m3u8" | jq -sRr @uri
  ```

## Troubleshooting

* **"YouTube returned a non-m3u8 url"**

  This can mean that deno/ejs or bgutil are not set up properly. It may also mean YouTube has temporarily stopped serving the m3u8 stream format to you.

* **"Sign in to confirm you’re not a bot"**

  This can mean that your IP address is being restricted by YouTube. This could happen if you are running VVP from a VPS provider or datacenter. Try running VVP on a home connection or through various VPNs.

To help debug issues, try running yt-dlp from the command line to see if deno and bgutil are working properly:

```bash
yt-dlp -v --simulate "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
```

Look out for lines that suggest Deno is being found and used such as:

```text
[debug] [youtube] [jsc] JS Challenge Providers: bun (unavailable), deno, node (unavailable), quickjs (unavailable)
[youtube] [jsc:deno] Solving JS challenges using deno
```

And look for lines that suggest that bgutil is working such as:

```text
[debug] [youtube] [pot] PO Token Providers: bgutil:http-1.2.2 (external), bgutil:script-1.2.2 (external, unavailable)
[youtube] [pot:bgutil:http] Generating a gvs PO Token for web client via bgutil HTTP server
[debug] [youtube] dQw4w9WgXcQ: Retrieved a gvs PO Token for web client
```

If these lines are present, then you should be able to retrieve an `.m3u8` url using the command:

```bash
yt-dlp -gS proto:m3u8 "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
```

If the returned URL does not end in `.m3u8`, then you may just be temporarily unlucky, as VVP currently only works with `.m3u8` playlists and not directly streamed video files.

## API Reference

### GET `/watch`

* **Description**: Invokes yt-dlp to fetch the video URL and rewrites the playlist to proxy through VVP
* **Query Parameters**:
  * `v`: The YouTube video ID
* **Response**:
  * The contents of the `.m3u8` playlists, with each segment rewritten to pass through VVP

### GET `/api/proxy`

* **Description**: Proxies and rewrites `.m3u8` playlists and `.ts` segments.
* **Query Parameters**:
  * `url`: The URL of the `.m3u8` playlist or `.ts` segment - urlencode this value to avoid issues
* **Response**:
  * For `.m3u8` playlists: Rewritten playlist with proxy URLs.
  * For `.ts` segments: The segment file.

## Additional Resources

### Get an m3u8 URL from yt-dlp

Urls passed to `/api/proxy` should be urlencoded. Using jq is an easy way to accomplish this:

`yt-dlp -gS proto:m3u8 "youtube-url" | jq -sRr @uri`

### Example `.m3u8` URLs for Testing

* **Big Buck Bunny**:

  ```bash
  echo "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8" | jq -sRr @uri
  ```

* **Apple Sample**:

  ```bash
  echo "https://devstreaming-cdn.apple.com/videos/streaming/examples/bipbop_4x3/bipbop_4x3_variant.m3u8" | jq -sRr @uri
  ```

## Acknowledgements

This repo is started as an esm rewrite of the [m3u8-streaming-proxy](https://github.com/MetaHat/m3u8-streaming-proxy) project by [Metahat](https://github.com/metahat)

## Contributing

If you encounter any issues or have any suggestions, feel free to open an issue.

Contributions are welcome, but I encourage you to open a ticket to discuss your ideas before you commit to work.

## License

This project is licensed under the MIT License. See the [LICENSE.txt](LICENSE.txt) file for details.
