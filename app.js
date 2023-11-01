const express = require("express");
const cors = require("cors");
const format = require("date-fns/format");
const formatRelative = require("date-fns/formatRelative");
const app = express();
app.use(express.json());
app.use(cors());
const { DateTime } = require("luxon");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const dbPath = path.join("./", "wikipedia.db");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
let db = null;
let port = process.env.PORT || 3001;
require("dotenv").config();
const jwtSecretKey = process.env.JWT_SECRET_KEY;
const initializeDbAndStartServer = async () => {
    try {
        db = await open({
            filename: dbPath,
            driver: sqlite3.Database,
        });
        app.listen(port, () => console.log("Server started at localhost:3001"));
    } catch (error) {
        console.log(`Error occurred ${error.message}`);
        process.exit(1);
    }
};
initializeDbAndStartServer();

const authVerification = (request, response, next) => {
    const authHeader = request.headers["authorization"];
    let jwtToken;
    if (authHeader !== undefined) {
        jwtToken = authHeader.split(" ")[1];
    }
    if (jwtToken === undefined) {
        response.status(401).send("Invalid Access Token");
    } else {
        jwt.verify(jwtToken, jwtSecretKey, (error, payload) => {
            if (error) {
                response.status(401).send("Invalid Access Token");
            } else {
                request.userDetails = payload;
                response.status(200);
                next();
            }
        });
    }
};

app.post("/register/", async (request, response) => {
    const { username, email, password } = request.body;
    const isEmailExistQuery = `select * from users 
    where email LIKE ?
    `;

    const isUsernameExistQuery = `
    select * from users
    where user_name LIKE ?
    `;

    try {
        const isEmailExist = await db.get(isEmailExistQuery, [email]);
        const isUsernameExist = await db.get(isUsernameExistQuery, [username]);

        if (isEmailExist) {
            response.status(409).send("User already exist");
        } else if (isUsernameExist) {
            response.status(409).send("Username already exists");
        } else {
            const query = `
                insert into users 
                (user_name,email,password)
                values (?,?,?)
                `;
            const hashedPassword = await bcrypt.hash(password, 10);
            const dbResponse = await db.run(query, [
                username,
                email,
                hashedPassword,
            ]);
            response.status(200).send("Successfully Registered");
        }
    } catch (error) {
        response.status(500).send("Server Error");
    }
});

app.post("/login/", async (request, response) => {
    const { username_or_email, password, is_username } = request.body;
    let isUserExistQuery = ``;
    if (is_username) {
        isUserExistQuery = `
        select 
        user_id,user_name,password,email
        from users
        where user_name LIKE ?
        `;
    } else {
        isUserExistQuery = `
        select 
        user_id,user_name,email,password
        from users
        where email LIKE ?
        `;
    }
    try {
        const userExist = await db.get(isUserExistQuery, [username_or_email]);
        if (!userExist) {
            response.status(401).send("Invalid login credentials");
        } else {
            const isPasswordMatched = await bcrypt.compare(
                password,
                userExist.password
            );
            if (isPasswordMatched) {
                const payload = {
                    userId: userExist.user_id,
                    username: userExist.user_name,
                    email: userExist.email,
                };
                const jwt_token = jwt.sign(payload, jwtSecretKey);
                response.status(200).send({ jwt_token });
            } else {
                response.status(401).send("Invalid login credentials");
            }
        }
    } catch (error) {
        response.status(500).send("Server Error");
    }
});

app.get("/profile/", authVerification, async (request, response) => {
    const { userId, username, email } = request.userDetails;
    response.send(username, email);
});

app.get("/history/", authVerification, async (request, response) => {
    const { limit = 5, offset = 0 } = request.query;
    const { userId, username, email } = request.userDetails;

    try {
        const history_data = [];
        const query = `
    SELECT
    user_id,
    history_date,
    history_id,title,url
    FROM
    history
    where user_id = ? and strftime("%Y-%m-%d",history_date) in (
        select strftime("%Y-%m-%d",history_date) dates from
        history
        where user_id = ?
        group by
        dates
        ORDER BY 
        dates DESC
        LIMIT ?
        OFFSET ? 
    )
    ORDER BY
    history_date DESC
    `;

        const historyResponse = await db.all(query, [
            userId,
            userId,
            limit,
            offset,
        ]);

        const historyData = historyResponse.reduce(
            (result, { history_date, history_id: historyId, title, url }) => {
                const date = format(new Date(history_date), "d MMM yyyy");
                const time = format(new Date(history_date), "h:mm aaa");
                let entryIndex = result.findIndex((item) => item.date === date);
                const historyItem = {
                    historyId,
                    time,
                    title,
                    url,
                };

                if (entryIndex === -1) {
                    entry = { date, history: [historyItem] };
                    result.push(entry);
                } else {
                    result[entryIndex].history.push(historyItem);
                }
                return result;
            },
            history_data
        );
        response.send(historyData);
    } catch (error) {
        console.log(error);
        response.status(500).send("Server Error");
    }
});

app.post("/history/", authVerification, async (request, response) => {
    const { title, link } = request.body;
    const { userId, username, email } = request.userDetails;
    const customTimeZone = "Asia/Kolkata";
    const dateInIndianTimeZone = DateTime.now().setZone(customTimeZone);
    const currentDate = dateInIndianTimeZone.toISO();

    try {
        const checkHistoryQuery = `
        select history_id from history
        where user_id = ? and
        title LIKE ?
        `;

        const checkHistoryResponse = await db.get(checkHistoryQuery, [
            userId,
            title,
        ]);

        if (checkHistoryResponse) {
            const updateHistoryQuery = `
            update history
            set history_date = ?
            where history_id = ?
            `;

            const updateHistoryResponse = await db.run(updateHistoryQuery, [
                currentDate,
                checkHistoryResponse.history_id,
            ]);
        } else {
            const historyQuery = `
            insert into history
            (user_id,title,url,history_date)
            values (?,?,?,?)
    `;
            const historyResponse = await db.run(historyQuery, [
                userId,
                title,
                link,
                currentDate,
            ]);
        }
    } catch (error) {
        console.log(error);
    }
});

app.delete("/history", authVerification, async (request, response) => {
    const { userId, username, email } = request.userDetails;
    const { historyIds } = request.body;
    const placeholders = historyIds.map((_, index) => "?").join(",");
    try {
        const historyDeleteQuery = `
        Delete from history
        where user_id = ? and history_id in (${placeholders})
        `;
        await db.run(historyDeleteQuery, [userId, ...historyIds]);
        response.status(200).send("Ok");
    } catch (error) {
        console.error(error);
        response.status(500).send("Server Error");
    }
});
