require("dotenv-safe").config();
const { phoneNumberFormatter, br2nl } = require("./helpers/formatter");
const express = require("express");
const nodemailer = require("nodemailer");
const http = require("http");
const axios = require('axios');
const qrcode = require("qrcode-terminal");
const { Client } = require("whatsapp-web.js");

const WABLAS_TOKEN = process.env.WABLAS_TOKEN;
const WABLAS_URL = process.env.WABLAS_URL;
const PORT = process.env.PORT || 5000;
const COUNTRY_CODE = process.env.COUNTRY_CODE || '62';
const PREFIX_TOKEN = process.env.PREFIX_TOKEN || 'TOKEN';
const SERV_TOKEN = process.env.TOKEN;
const AB_URL = process.env.AB_URL;

const admin = '6282122504953';
const phone = process.env.DEBUG_PHONE || '6282122504953';
const email = process.env.DEBUG_PHONE || 'virdigunawann@gmail.com';
const timeout = 300000; // 5 menit

const app = express();
const server = http.createServer(app);
const client = new Client({
	authTimeoutMs: timeout,
	qrTimeoutMs: timeout,
	qrRefreshIntervalMs: 150000,
	restartOnAuthFail: true,
	puppeteer: {
		headless: true,
		args: [
			"--no-sandbox",
			"--disable-setuid-sandbox",
			"--disable-dev-shm-usage",
			"--disable-accelerated-2d-canvas",
			"--no-first-run",
			"--no-zygote",
			"--single-process", // <- this one doesn't works in Windows
			"--disable-gpu",
		],
	},
});

// generate qr code, tampil di terminal
client.on("qr", (qr) => {
	qrcode.generate(qr, { small: true });
});

// kalo udah bisa digunain, tampil ini
client.on("ready", () => {
	console.log("Client is ready!");
});

// kalo scan qr code bisa, tampil ini
client.on("authenticated", (session) => {
	console.log("AUTHENTICATED");
	console.log(session);
});

client.on("auth_failure", function (session) {
	console.log("FAILURE");
	console.log(session);
});

client.on("disconnected", (reason) => {
	client.destroy();
	sendMail(email, reason);
	client.initialize();
});

client.initialize();

// Sending message.
// forward pesan masuk
// client.on("message", async (message) => {
// 	// personal: 6281586348601@c.us
// 	// grup: 6281586348601@g.us
// 	let from = message.from.split("@");
// 	let sender = from[0];
// 	let body = message.body;
// 	let msg = `Pesan baru masuk ke sistem.

// Pengirim: ${sender}
// Isi Pesan:
// ${body}
// `;

// 	let phone = phoneNumberFormatter(admin, COUNTRY_CODE);
// 	let isRegisteredNumber = await checkRegisteredNumber(phone);

// 	if (!isRegisteredNumber) {
// 		return console.log('The number is not registered');
// 	}

// 	// console.log(msg);
// 	client.sendMessage(phone, msg).then(response => {
// 		// console.log(response);
// 	}).catch(err => {
// 		// console.log(err);
// 	});
// });

// forward pesan masuk ke web ab
client.on("message", async (message) => {
	sendToAB(message);
});

app.use(express.json());
app.use(
	express.urlencoded({
		extended: true,
	})
);

app.post("/send-message", async (req, res) => {
	let auth = await checkToken(req);
	if (!auth) {
		return res.status(403).json({
			status: false,
			message: 'Not Authorized'
		});
	}

	let request = req.body;
	let phone = phoneNumberFormatter(request.phone, COUNTRY_CODE);
	let isRegisteredNumber = await checkRegisteredNumber(phone);
	let detail = await checkNumberDetail(phone);

	if (!isRegisteredNumber) {
		return res.status(422).json({
			status: false,
			message: 'The number is not registered'
		});
	}

	if (!detail) {
		return res.status(422).json({
			status: false,
			message: 'The number is not registered'
		});
	}

	return client.sendMessage(phone, br2nl(request.message)).then(response => {
		return res.status(200).json({
			status: true,
			response: response
		});
	}).catch(err => {
		return res.status(500).json({
			status: false,
			response: err
		});
	});
});

// app.post("/webhook", async (req, res) => {
// 	try {
// 		// let request = req.body;
// 		axios({
// 			method: 'POST',
// 			url: WABLAS_URL,
// 			headers: {
// 				Accept: "application/json",
// 				"Content-Type": "application/json",
// 				Authorization: WABLAS_TOKEN,
// 			},
// 			data: JSON.stringify(req.body)
// 		})
// 			.then(function (response) {
// 				// handle success
// 				console.log(response);
// 			})
// 			.catch(function (error) {
// 				// handle error
// 				console.log(error);
// 			})
// 			.then(function () {
// 				// always executed
// 			});

// 	} catch (err) {
// 		console.log(err);
// 	}
// });

// buat kirim email ke admin kalo wa disconnected
const sendMail = async (email, reason) => {
	try {
		let transporter = nodemailer.createTransport({
			service: "gmail",
			port: 465,
			// protocol: "TLS",
			secureConnection: true,
			logger: true,
			auth: {
				user: email,
				pass: "password",
			},
		});

		let stringify = JSON.stringify(reason)
		let mailOptions = {
			from: "noreply@example.com",
			to: email,
			subject: "WA DISCONNECTED",
			text: stringify,
			html: stringify,
		};

		try {
			await transporter.sendMail(mailOptions, (err, info) => {
				if (err) {
					console.log(err);
				}

				// console.log(info);
			});
		} catch (err) {
			console.log(err);
		}
	} catch (err) {
		console.log(err);
	}
}

// buat kirim web ab
const sendToAB = async (message) => {
	try {
		axios({
			method: 'POST',
			url: AB_URL,
			headers: {
				Accept: "application/json",
				"Content-Type": "application/json",
			},
			data: JSON.stringify(message)
		})
			.then(function (response) {
				// handle success
				console.log(response);
			})
			.catch(function (error) {
				// handle error
				console.log(error);
			})
			.then(function () {
				// always executed
			});
	} catch (err) {
		console.log(err);
	}
}

// buat token
const checkToken = (req) => {
	let auth = req.header('Authorization');
	if (!auth) {
		return false;
	}

	let getToken = auth.split(":");
	let prefix = getToken[0];
	if (prefix !== PREFIX_TOKEN) {
		return false;
	}

	let token = getToken[1];
	return token === SERV_TOKEN;
}

// buat cek nomornya punya wa apa enggak
const checkRegisteredNumber = async (number) => {
	const isRegistered = await client.isRegisteredUser(number);
	return isRegistered;
}

// buat cek nomornya punya wa apa enggak
const checkNumberDetail = async (number) => {
	const detail = await client.getNumberId(number);
	return detail;
}

server.listen(PORT, function () {
	console.log(`Server is now listen on http://localhost:${PORT}`);
});
