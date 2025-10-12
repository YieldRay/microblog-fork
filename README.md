> Fork of <https://github.com/fedify-dev/microblog>  
> To test the user, use <https://activitypub.academy/>  
> <https://localhost.run/>

# Federated microblog example using Fedify

> [!WARNING]
> This program is for educational purposes only. Do not use it for any other
> purpose, since it has not been tested for security.

This is a simple federated microblog example using [Fedify]. The features of
this program are:

- A user can create an account
- A user can be followed by other actors in the fediverse
- A user (or a follower) can unfollow an actor
- A user can see the list of their followers
- A user can post a message
- Posts made by a user are visible to their followers in the fediverse
- A user can follow other actors in the fediverse
- A user can see the list of actors they are following
- A user can see the list of posts made by actors they are following
- Basic profile customization (display name, bio, avatar, header, location,
  website)

Since this is a simple example for educational purposes, it also has a lot of
limitations:

- No account deletion
- Posts cannot be edited or deleted after creation
- No likes, boosts/reposts, or threaded replies (notification UI exists,
  but these social actions are intentionally minimal)
- No search feature
- Basic local authentication (username/password) exists for the demo, but the
  authentication/authorization model is intentionally simplistic and not
  production-ready

[Fedify]: https://fedify.dev/

## Dependencies

This program is written in TypeScript and uses [Node.js]. You need to have
Node.js 20.0.0 or later installed on your system to run this program.

It also depends on few external libraries besides [Fedify]:

- [Hono] for web framework
- [SQLite] for database
- A few other libraries; see _package.json_ for details

[Node.js]: https://nodejs.org/
[Hono]: https://hono.dev/
[SQLite]: https://www.sqlite.org/

## How to run

To run this program, you need to install the dependencies first. You can do
that by running the following command:

```sh
npm install --include=dev
```

You can run the program using the following command, if `process.env.DATABASE_URL_POSTGRES` is not set, a local sqlite db file will be created automatically:

```sh
npm run prod
```

This will start the program on port 8000. You can access the program by
visiting <http://localhost:8000/> in your web browser. However, since this
program is an ActivityPub server, you probably need to expose it to the public
internet to communicate with other servers in the fediverse. In that case, you
can use [tunneling services][1].

[1]: https://fedify.dev/manual/test#exposing-a-local-server-to-the-public

## License

This program is licensed under the [MIT License]. See the _LICENSE_ file for
details.

[MIT License]: https://minhee.mit-license.org/2024/
