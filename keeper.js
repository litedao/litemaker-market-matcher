var Web3 = require('web3')
var web3 = new Web3()
web3.setProvider(new web3.providers.HttpProvider('http://localhost:8545'))
web3.eth.defaultAccount = web3.eth.accounts[0]

var dapple = require('./build/js_module.js')
var Dapple = new dapple.class(web3, 'morden')
var sugar = require('sugar')
var config = require('./config.global.js')

var offers = []
var bids = []
var asks = []

startKeeper()

function startKeeper() {
    console.log('Maker market matcher started!')
    Dapple.objects.matcher.balanceOf(config.quote_currency.address, function(error, result) {
        if(!error) {
            var balance = result.toNumber()
            if(balance != undefined && balance > 0) {
                console.log('Balance: ' + balance + ' ' + config.quote_currency.name)
                startSynchronization()
            }
            else {
                console.log('Insufficient balance')
                process.exit(1)
            }
        } 
        else {
            console.log('Startup error: ', error)
            process.exit(1)
        }
    })
}

function startSynchronization() {
    Dapple.objects.otc.last_offer_id(function (error, result) {
        if(!error) {
            var id = result.toNumber()
            if(id > 0) {
                console.log('Synchronizing offers from maker market')
                synchronizeOffer(id, id)
            }
        }
        else {
            console.log('Synchronization error has occured: ' + error)
        }
    })  
    watchForUpdates()
}

function synchronizeOffer(offer_id, max) {
    Dapple.objects.otc.offers(offer_id, function (error, data) {
        if(!error) { 
            var sell_how_much = data[0]
            var sell_which_token = data[1]
            var buy_how_much = data[2]
            var buy_which_token = data[3]
            var owner = data[4]
            var active = data[5]
            if(active) {
                updateOffer(offer_id, sell_how_much, sell_which_token, buy_how_much, buy_which_token, owner)
            }
            else {
                removeOffer(offer_id, sell_which_token)
            }
        }
        else {
            console.log('Synchronize offer error occured: ' + error)
        }
        if(max > 0 && offer_id > 1) {
            synchronizeOffer(offer_id - 1, offer_id)
        }
        else {
            sortOffers()            
            showActiveOffers()
            tradeComplete()
            trade()
        }
    })
}

function watchForUpdates() {
    Dapple.objects.otc.ItemUpdate(function (error, result) {
        if(!error) {
            console.log('Item update has occured')
            console.log(result)
            var id = result.args.id.toNumber()
            synchronizeOffer(id)
        }
        else {
            console.log('ItemUpdate error: ' + error)
        }
    })
}

function trade() {
    console.log('Looking for possible trades')
    //TODO- take gas costs into account
    if(bids[0] != null && asks[0] != null && bids[0].price > asks[0].price && !bids[0].pending && !asks[0].pending) {
        bids[0].pending = true
        asks[0].pending = true
        console.log('Executing trade for bid id: ', bids[0].id, ' and ask id: ', asks[0].id)
        console.log('Current balance')
        showBalance()
        Dapple.objects.matcher.trade(bids[0].id, asks[0].id, bids[0].buy_which_token, bids[0].sell_which_token,
         Dapple.objects.otc.address, {gas: config.trade_gas_costs }, function(error, result) {
            if(!error) {
                console.log('Trade executed')
            }
            else {
                console.log('Trade error occured: ' + error)
            }
        })
    }
    else {
        console.log('No matching trades found. Waiting for new trades.')
    }
}

function showActiveOffers() {
    console.log('Bids')
    bids.forEach(function(offer) {
        console.log('Id: ' + offer.id + ' Sell token: ' + config.quote_currency.name + ' Sell how much: ' + offer.sell_how_much
        + ' Buy token: ' + config.base_currency.name + ' Buy how much: ' + offer.buy_how_much + ' Price: ' + offer.price)
    })
    console.log('Asks')
    asks.forEach(function(offer) {
        console.log('Id: ' + offer.id + ' Sell token: ' + config.base_currency.name + ' Sell how much: ' + offer.sell_how_much
        + ' Buy token: ' + config.quote_currency.name + ' Buy how much: ' + offer.buy_how_much + ' Price: ' + offer.price)
    })
}

function updateOffer(id, sell_how_much, sell_which_token, buy_how_much, buy_which_token, owner) {
    var price = 0
    if(sell_which_token == config.quote_currency.address) {
        price = sell_how_much.div(buy_how_much).toNumber()
    }
    else if(sell_which_token == config.base_currency.address) {
        price = buy_how_much.div(sell_how_much).toNumber()
    }
    
    var newOffer = {
        id: id,
        owner: owner,
        buy_which_token: buy_which_token,
        sell_which_token: sell_which_token,
        sell_how_much: sell_how_much.toString(10),
        buy_how_much: buy_how_much.toString(10),
        price: price,
        pending: false
    }
    
    if(sell_which_token == config.base_currency.address && buy_which_token == config.quote_currency.address) {
        insertOffer(newOffer, asks)
    }
    else if(sell_which_token == config.quote_currency.address && buy_which_token == config.base_currency.address) {
        insertOffer(newOffer, bids)
    }
}

function insertOffer(newOffer, offers) {
    var currentOffer = offers.find(function(offer) {
        return offer.id === newOffer.id
    })
    
    if(currentOffer == null) {
        offers.add(newOffer)    
    }
    else
    {
        currentOffer.buy_how_much = newOffer.buy_how_much.toString(10)
        currentOffer.sell_how_much = newOffer.sell_how_much.toString(10)
        currentOffer.price = newOffer.price
    }
}

function removeOffer(offer_id, sell_which_token) {
    if(sell_which_token == config.base_currency.address) {
        asks.remove(function(offer) { return offer.id === offer_id})
    }
    else if(sell_which_token == config.quote_currency.address) {
        bids.remove(function(offer) { return offer.id === offer_id})
    }
}

function tradeComplete() {
    Dapple.objects.matcher.TradeComplete(function (error, result) {
        if(!error) {
            console.log('Trade quantities: ' + 'ask ' + result.args.ask_quantity.toString(), ' bid ',result.args.buy_quantity.toString())
            showBalance() 
        }
        else {
            console.log('Trade error occured: ', error)
        }
    })
}

function showBalance() {
    Dapple.objects.matcher.balanceOf(config.quote_currency.address, function(error, result) {
        if(!error) {
            console.log(config.quote_currency.name + ' balance: ', result.toString())
        } 
        else {
            console.log('Error: ', error)
        }
    })
    Dapple.objects.matcher.balanceOf(config.base_currency.address, function(error, result) {
        if(!error) {
            console.log(config.base_currency.name + ' balance: ', result.toString())
        } 
        else {
            console.log('Error: ', error)
        }
    })
}

function sortOffers() {
    bids.sort(function(a,b) {
        return b.price - a.price
    })
    
    asks.sort(function(a,b) {
        return a.price - b.price 
    })
}

function min(a, b) {
    if (a < b) {
        return a    
    } 
    else {
        return b
    }
}

function formattedString (str) {
    return web3.toAscii(str).replace(/\0[\s\S]*$/g, '').trim()
}