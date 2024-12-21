import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import timeout from "connect-timeout";
import './global.js';
import fs from "fs";


import { logMessage, writeDataToJsonFile } from "./logger/logger.js";
import {Db} from "./services/db.js";
import {decryptText, encryptText, generateCryptoKeyAndIV} from "./services/crypto.js";
import { DealsService } from "./services/deals.js";

const envPath = path.join(process.cwd(), '.env');
dotenv.config({ path: envPath });

const app = express();
const PORT = 4560;

const BASE_URL = "/dh_price_counter/"

const db = new Db();
db.createTables();

app.use(cors({
    origin: "*",
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(timeout('20m'));

function haltOnTimedOut(req, res, next) {
    if (!req.timedout) next();
}

app.post(BASE_URL+"get_deals_with_productrows/", async (req ,res) => {
    try {
        const deals = await db.getAll("deals");
        const deals_products = await db.getAll("deals_products");

        const data = [];
        deals.forEach(deal => {
            const dps = deals_products.filter(dp => dp.deal_id === deal.id).map(dp => {
                return {
                    product_id: dp.product_id,
                    product_name: dp.product_name,
                    price: dp.price,
                    discount: dp.discount
                }
            });
            data.push({ deal_id: deal.id, date_create: deal.date_create, deal_title: deal.title, productrows: dps })
        })

        res.status(200).json({"status": true, "status_msg": "success", "message": "Сделки успешно записаны в бд", "data": data});
    } catch (error) {
        logMessage(LOG_TYPES.E, "/get_deals_with_productrows/", error);
        res.status(500).json(RESPONSES.INTERNAL_SERVER_ERROR);
    }
})

app.post(BASE_URL+"add_deal_handler/", async (req, res) => {
    try {
        let id = req.query["ID"];
        if (!id) {
            id = req.body["data[FIELDS][ID]"];
        }
        if (!id) {
            logMessage(LOG_TYPES.E,BASE_URL+"update_deal_handler", "No deal id provided");
            res.status(400).json({"status": false, "status_msg": "error", "message": "No deal id provided"});
            return;
        }

        const bxLinkDecrypted = await decryptText(process.env.BX_LINK, process.env.CRYPTO_KEY, process.env.CRYPTO_IV);
        const dealsService = new DealsService(bxLinkDecrypted);

        const deal = await dealsService.getDealById(id);
        if (Number(deal.category_id) !== 68 && Number(deal.price_type) !== 616) {
            throw new Error(`Deal ${id} is not in categroy 68 or price type is not 616`)
        }
        db.insertInTable("deals", deal);
        const records = [];
        const productrows = await dealsService.getDealProductRows(deal.id);
        productrows.forEach(productrow => {
            records.push({deal_id: deal.id, product_id: productrow["PRODUCT_ID"], product_name: productrow["PRODUCT_NAME"], price: productrow["PRICE_BRUTTO"], discount: productrow["DISCOUNT_SUM"]});
        })
        db.insertMultipleInTable("deal_products", records);

        logMessage(LOG_TYPES.A, BASE_URL+"add_deal_handler/", `Deal ${deal.id} and it's productrows successfully added to db`);
        res.status(200).json({"status": true, "status_msg": "success", "message": "Сделки успешно записаны в бд", "deal": deal})
    } catch (error) {
        logMessage(LOG_TYPES.E, "/add_deal_handler/", error);
        res.status(500).json(RESPONSES.INTERNAL_SERVER_ERROR);
    }
})

app.post(BASE_URL+"get_deals_from_bx_insert_in_db/", async (req, res) => {
    try {
        const bxLinkDecrypted = await decryptText(process.env.BX_LINK, process.env.CRYPTO_KEY, process.env.CRYPTO_IV);
        const dealsService = new DealsService(bxLinkDecrypted);

        const deals = (await dealsService.getDealsByFilter({ "UF_CRM_1710140074001": 616, "CATEGORY_ID": 68 })).map(deal => {
            return {
                "id": deal["ID"],
                "title": deal["TITLE"],
                "category_id": deal["CATEGORY_ID"],
                "price_type": deal["UF_CRM_1710140074001"],
                "date_create": deal["DATE_CREATE"]
            }
        });
        if (!deals && deals.length <= 0) {
            logMessage(LOG_TYPES.E, "/get_deals_from_bx_insert_in_db/", "Error getting deals from bx");
            throw new Error("Error getting deals from bx");
        }
        await db.insertMultipleInTable("deals", deals);

        logMessage(LOG_TYPES.A, BASE_URL+"get_deals_from_bx_insert_in_db/", `Deals successfully added to db`);
        res.status(200).json({"status": true, "status_msg": "success", "message": "Сделки успешно записаны в бд", "deals": deals});
    } catch (error) {
        logMessage(LOG_TYPES.E, "/get_deals_from_bx_insert_in_db/", error);
        res.status(500).json(RESPONSES.INTERNAL_SERVER_ERROR);
    }
}, haltOnTimedOut)

app.post(BASE_URL+"get_deals_product_rows_from_bx_insert_in_db/", async (req, res) => {
    try {
        const bxLinkDecrypted = await decryptText(process.env.BX_LINK, process.env.CRYPTO_KEY, process.env.CRYPTO_IV);
        const dealsService = new DealsService(bxLinkDecrypted);

        const deals = await db.getAll("deals")
        let records = [];
        for (const deal of deals) {
            const productrows = await dealsService.getDealProductRows(deal.id);
            productrows.forEach(productrow => {
                records.push({deal_id: deal.id, product_id: productrow["PRODUCT_ID"], product_name: productrow["PRODUCT_NAME"], price: productrow["PRICE_BRUTTO"], discount: productrow["DISCOUNT_SUM"]});
            })
        }
        db.insertMultipleInTable("deals_products", records);

        logMessage(LOG_TYPES.A, BASE_URL+"get_deals_product_rows_from_bx_insert_in_db/", `Deals' productsrows successfully added to db`);
        res.status(200).json({"status": true, "status_msg": "success", "total": deals.length, "deals": deals})
    } catch (error) {
        logMessage(LOG_TYPES.E, "/get_deals_from_bx_insert_in_db/", error);
        res.status(500).json(RESPONSES.INTERNAL_SERVER_ERROR);
    }
}, haltOnTimedOut)

app.post(BASE_URL+"write_backlog/", async (req, res) => {
    try {
        const data = req.body.data;
        await writeDataToJsonFile(data);
    } catch (error) {
        logMessage(LOG_TYPES.E, "/write_backlog/", error);
        res.status(500).json(RESPONSES.INTERNAL_SERVER_ERROR);
    }
})

app.post(BASE_URL + "init/", async (req, res) => {
    try {
        const bxLink = req.body.bx_link;
        if (!bxLink) {
            res.status(400).json({
                "status": false,
                "status_msg": "error",
                "message": "Необходимо предоставить ссылку входящего вебхука!"
            });
            return;
        }

        const keyIv = generateCryptoKeyAndIV();
        const bxLinkEncrypted = await encryptText(bxLink, keyIv.CRYPTO_KEY, keyIv.CRYPTO_IV);

        const bxLinkEncryptedBase64 = Buffer.from(bxLinkEncrypted, 'hex').toString('base64');

        const envPath = path.resolve(process.cwd(), '.env');
        const envContent = `CRYPTO_KEY=${keyIv.CRYPTO_KEY}\nCRYPTO_IV=${keyIv.CRYPTO_IV}\nBX_LINK=${bxLinkEncryptedBase64}\n`;

        fs.writeFileSync(envPath, envContent, 'utf8');

        res.status(200).json({
            "status": true,
            "status_msg": "success",
            "message": "Система готова работать с вашим битриксом!",
        });
    } catch (error) {
        logMessage(LOG_TYPES.E, BASE_URL + "/init", error);
        res.status(500).json({
            "status": false,
            "status_msg": "error",
            "message": "Server error"
        });
    }
});


app.listen(PORT, async () => {
    console.log(`App running on port ${PORT}`)
})