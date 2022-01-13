const Redis = require('ioredis');
const express = require("express");
const {createServer} = require("http");
const {execute, subscribe} = require("graphql");
const {PubSub} = require("graphql-subscriptions");
const {makeExecutableSchema} = require("@graphql-tools/schema");
const {SubscriptionServer} = require("subscriptions-transport-ws");
const {gql, ApolloServerPluginLandingPageGraphQLPlayground} = require("apollo-server-core");
const {ApolloServer} = require("apollo-server-express");
const {RedisPubSub} = require("graphql-redis-subscriptions");

const PONG_EVENT_NAME = 'pong';

const typeDefs = gql`
    type Ping {
        id: ID
    }
    type Query {
        noop: Boolean
    }
    
    type Mutation {
        ping: Ping
    }
    
    type Subscription {
        pingId: ID
    }
    
`;

// ==== PubSub =========================================================================================================

// =======================================
// # UN-COMMENT to use Redis Broker.
// const options = {
//     host: 'my-first-redis.sxha1z.0001.use1.cache.amazonaws.com',
//     port: 6379
// }
// const pubsub = new RedisPubSub({
//     publisher: new Redis(options),
//     subscriber: new Redis(options)
// });
// ========================================

// =======================================
// # UN-COMMENT NO Redis broker.
const pubsub = new PubSub();
// =======================================

// ==== Resolvers ======================================================================================================
const resolvers = {
    Query: {
        noop: () => false
    },

    Mutation: {
        ping(parent, args, context) {
            const pingId = Date.now().toString();
            pubsub.publish(PONG_EVENT_NAME, { pingId });
            return {id: pingId};
        }
    },

    Subscription: {
        pingId: {
            subscribe: () => pubsub.asyncIterator(PONG_EVENT_NAME),
        }
    }

};

// ==== Main ===========================================================================================================
(async function() {
    // establish express
    const app = express();

    // create httpServer around express
    const httpServer = createServer(
        app
    );

    // build schema with typeDefs and resolvers.
    const schema = makeExecutableSchema({
        typeDefs,
        resolvers
    });

    // subscription server with websocket support
    SubscriptionServer.create(
        {schema, execute, subscribe},
        {server: httpServer, path: '/graphql'}
    );

    // apollo server using the schema and enabled GraphQLPlayground instead of Apollo Explorer.
    const server = new ApolloServer({
        schema,
        plugins: [
            ApolloServerPluginLandingPageGraphQLPlayground({
                // options
            })
        ]
    });

    // start the server.
    await server.start();

    // apply server middleware to express app
    server.applyMiddleware({app});


    // if port is specified in environment use it otherwise default to 4000
    const PORT = process.env.PORT ? process.env.PORT : 4000;
    httpServer.listen(PORT, () =>
        console.log(`Server is now running on http://localhost:${PORT}/graphql`)
    );

})();
