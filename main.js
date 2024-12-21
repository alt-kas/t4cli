const io = require("socket.io-client");
const rl = require("readline-sync");
const axios = require("axios");
const fs = require("node:fs");

const serverURL = "https://api.talkium.in"

async function isServerOnline() {
    const res = await axios.get(serverURL);
    if (res.status === 200 && res.data?.status === 200) {
        return true;
    }
    return false;
}

async function getUsers() {
    const res = await axios.get(`${serverURL}/users`);
    if (res.status === 200 && res.data?.status === 200) {
        return res.data.message;
    }
    return null;
}

function parseREPL(input) {
    if (typeof input !== "string") {
        throw new Error("Input is not a string.")
    }
    const spaceSeparated = input.split(" ");
    const cmd = spaceSeparated.shift().toLowerCase();
    const args = spaceSeparated;
    
    return {cmd, args}
}

async function main(args) {
    async function login() {
        if (fs.existsSync("jwt")) {
            const data = fs.readFileSync("jwt", "utf-8");
            return data;
        }
        let username = rl.question("Enter your username: ");
        username = username.trim();
        if (username === "") {
            throw new Error("Please enter a valid username.");
        }

        const users = await getUsers();
        if (!users) {
            throw new Error("`/users` route returned invalid an response.");
        }
        const selUser = users.find(user => user.username === username);
        if (!selUser) {
            throw new Error(`User ${username} does not exist.`);
        }

        const password = rl.question("Enter your password: ", {
            hideEchoBack: true
        });
        if (password.length < 8) {
            throw new Error("Please enter a valid password.");
        }

        const res = await axios.post(`${serverURL}/auth/signin`, { username, password });
        if (res.status !== 200) {
            throw new Error(`Server responded with ${res.status} HTTP(S) status code.`);
        }
        const data = res.data || {};
        if (data.status !== 200) {
            throw new Error(`Server responded with ${data.status} status code. Message: ${data.message}`);
        }

        const token = data.message;

        fs.writeFileSync("jwt", token);

        return token;
    };

    async function register() {
        // TODO: Register a user.
    };

    console.log("Checking server status...")
    if (!(await isServerOnline())) {
        throw new Error("Server is not ready.");
        return;
    }
    console.log("Server is ready.")

    console.log("Please login to continue.");
    // TODO: Add an option to register.
    const token = await login();
    console.log("Logged in with", token);

    await loadRepl(token);
}

async function loadRepl(token) {
    let prompt = "";
    let scopes = { // user accessable variables
        conversations: {
            1: "myConversation",
            4: "anotherConv"
        },
        drafts: {
            myMsg: "hello everyone",
            msg: "what is the time now?"
        }
    };
    let scopeDefinitions = {
        conversations: ["ID", "Conversation Name"],
        drafts: ["Name", "Message"]
    }

    const replCmds = {};

    replCmds.prompt = {
        description: "Customize prompt",
        activate: (...args) => {
            prompt = args.join(" ");
        }
    }

    replCmds.draft = {
        description: "Save a message in draft",
        activate: (name, ...args) => {
            scopes.drafts[name] = args.join(" ");
            console.log(`Draft '${name}' saved as '${args.join(" ")}'`);
        }
    }

    replCmds.list = {
        description: "Show scopes",
        activate: (_scope) => {
            let scope = scopes[_scope];
            if (!scope || !scopeDefinitions[_scope]) {
                console.log("Available scopes are");
                for (let i = 0; i < Object.keys(scopes).length; i++) {
                    console.log(Object.keys(scopes)[i]);
                }
                return;
            }
    
            console.log(`${scopeDefinitions[_scope][0].padEnd(20)} ${scopeDefinitions[_scope][1]}`)
            for (let i in scope) {
                console.log(i.padEnd(20), scope[i]);
            }
        }
    }

    replCmds.exit = {
        description: "Exit the REPL",
        activate: () => {
            process.exit(0);
        }
    }

    replCmds.clear = {
        description: "Clear the screen",
        activate: () => {
            console.clear();
        }
    }

    replCmds.whoami = {
        description: "Shows current user's username",
        activate: async () => {
            const res = await axios.get(`${serverURL}/auth/user`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            if (res.status !== 200) {
                console.error(`Server responded with a ${res.status} HTTP(S) status code`);
                return;
            }

            if (res.data.status !== 200) {
                console.error(`Server responded with ${data.status} status code. Message: ${data.message}`);
                return;
            }
            
            const user = res.data.message;
            const username = user.username;

            console.log(`Logged in as ${username}`);
        }
    }

    replCmds.help = {
        description: "Display this help menu",
        activate: () => {
            console.log("Talkium CLI (v1.0.0)");
            console.log("Help Menu");
            console.log("Available Commands\n");
            let cmds = Object.keys(replCmds);
            for (let i = 0; i < cmds.length; i++) {
                console.log(cmds[i].padEnd(20), replCmds[cmds[i]].description);
            }
        }
    }

    while (true) {
        const cmdString = rl.question(`${prompt}> `);
        const {cmd, args} = parseREPL(cmdString);
        
        if (cmd === "") { continue }

        if (replCmds[cmd]) {
            await replCmds[cmd].activate(...args);
        } else {
            console.error(`${cmd} is not a valid command in this REPL`);
        }
    }
}

try {
    main([ ...process.argv ]);
} catch (err) {
    console.error(err);
}
