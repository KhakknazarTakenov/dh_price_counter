import { Bitrix } from "@2bad/bitrix";
import { logMessage } from "../logger/logger.js";

const pageSize = 50;

class DealsService {
    constructor(link) {
        this.bx = Bitrix(link);
    }

    getDealById(id) {
        return new Promise(async (resolve, reject) => {
            try {
                const deal = await this.bx.deals.get(id);
                resolve(
                    {
                        "id": deal["ID"],
                        "title": deal["TITLE"],
                        "category_id": deal["CATEGORY_ID"],
                        "price_type": deal["UF_CRM_1710140074001"],
                        "date_create": deal["DATE_CREATE"]
                    }
                );
            } catch (error) {
                logMessage(LOG_TYPES.E, "DealsService.getDealsByFilter", `Error getDealsByFilter: ${error}`);
                resolve(null)
            }
        })
    }

    getDealsByFilter(filter) {
        return new Promise(async (resolve, reject) => {
            try {
                const allResults = [];
                let res;

                let start = 0;
                let total = 0;

                do {
                    res = await this.bx.deals.list(
                        {
                            "select": ["ID", "TITLE", "CATEGORY_ID", "UF_CRM_1710140074001", "DATE_CREATE"],
                            "filter": filter,
                            "start": start
                        }
                    )

                    total = res.total;
                    start += pageSize;

                    allResults.push(...res.result);
                    if (res.total < pageSize) {
                        break;
                    }
                } while(start < total)
                resolve(allResults);
            } catch (error) {
                logMessage(LOG_TYPES.E, "DealsService.getDealsByFilter", `Error getDealsByFilter: ${error}`);
                resolve(null)
            }
        })
    }

    getDealProductRows(id) {
        return new Promise(async (resolve, reject) => {
            try {
                 const res = await this.bx.call("crm.deal.productrows.get", { id: id });
                 const productrows = res.result.map(productrow => {
                     return {
                         "PRODUCT_ID": productrow["PRODUCT_ID"],
                         "PRODUCT_NAME": productrow["PRODUCT_NAME"],
                         "PRICE_BRUTTO": productrow["PRICE_BRUTTO"],
                         "DISCOUNT_SUM": productrow["DISCOUNT_SUM"]
                     }
                 })
                resolve(productrows);
            } catch (error) {
                logMessage(LOG_TYPES.E, "DealsService.getDealProductRows", `Error getDealProductRows: ${error}`);
                resolve(null)
            }
        })
    }
}

export { DealsService }