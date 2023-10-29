const nodemailer = require("nodemailer");
const jwt = require("jsonwebtoken");

const sendMail = async (request, response) => {
    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: "sanford.balistreri21@ethereal.email",
            pass: "WQMEeJCzQeKAz4ZBzy",
        },
    });
    const token = jwt.sign(
        {
            data: "Token Data",
        },
        "ourSecretKey",
        { expiresIn: "10m" }
    );
    const mailConfigurations = {
        // It should be a string of sender/server email
        from: "mrtwinklesharma@gmail.com",

        to: "smtwinkle451@gmail.com",

        // Subject of Email
        subject: "Email Verification",

        // This would be the text of email body
        text: `Hi! There, You have recently visited  
           our website and entered your email. 
           Please follow the given link to verify your email 
           http://localhost:3000/verify/${token}  
           Thanks`,
    };

    transporter.sendMail(mailConfigurations, function (error, info) {
        if (error) throw Error(error);
        console.log("Email Sent Successfully");
        console.log(info);
    });

    // const transporter = nodemailer.createTransport({
    //     host: "smtp.ethereal.email",
    //     port: 587,
    //     auth: {
    //         user: "sanford.balistreri21@ethereal.email",
    //         pass: "WQMEeJCzQeKAz4ZBzy",
    //     },
    // });
    // const info = await transporter.sendMail({
    //     from: '"Fred Foo 👻" <foo@example.com>', // sender address
    //     to: "chongalateja1234@gmail.com", // list of receivers
    //     subject: "Hello ✔", // Subject line
    //     text: "Hello world?", // plain text body
    //     html: "<b>Hello world?</b>", // html body
    // });
    // console.log("Message id", info.messageId);
    // response.json(info);
};

module.exports = sendMail;
// const transporter = nodemailer.createTransport({
//     service: "Gmail",
//     auth: {
//         user: "jaichongala1234@gmail.com",
//         pass: "jaichongala@7849",
//     },
// });
