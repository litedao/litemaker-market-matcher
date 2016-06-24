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

//TODO Check arguments whether to start keeper, deposit/withdraw tokens or check the balance

startKeeper()
//getOfferInfo()
//showBalance()

function startKeeper() {
    console.log('Maker market matcher started!')
    Dapple.objects.otc.last_offer_id(function (error, result) {
        if(!error) {
            var id = result.toNumber()
            console.log(id)
            if(id > 0) {
                console.log('Synchronizing offers from maker market')
                synchronizeOffer(id, id)
            }
        }
        else {
            console.log(error)
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
            checkQuantities()
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
    //TODO-FP take gas costs into account
    if(bids[0] != null && asks[0] != null && bids[0].price > asks[0].price) {
        console.log('Executing trade for bid id: ', bids[0].id, ' and ask id: ', asks[0].id)
        Dapple.objects.matcher.trade(bids[0].id, asks[0].id, bids[0].buy_which_token, bids[0].sell_which_token,
         Dapple.objects.otc.address, {gas: config.trade_gas_costs }, function(error, result) {
            if(!error) {
                console.log(result)
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
        console.log('Id: ' + offer.id + ' Sell token: ' + offer.sell_which_token + ' Sell how much: ' + offer.sell_how_much
        + ' Buy token: ' + offer.buy_which_token + ' Buy how much: ' + offer.buy_how_much + ' Price: ' + offer.price)
    })
    console.log('Asks')
    asks.forEach(function(offer) {
        console.log('Id: ' + offer.id + ' Sell token: ' + offer.sell_which_token + ' Sell how much: ' + offer.sell_how_much
        + ' Buy token: ' + offer.buy_which_token + ' Buy how much: ' + offer.buy_how_much + ' Price: ' + offer.price)
    })
}

function updateOffer(id, sell_how_much, sell_which_token, buy_how_much, buy_which_token, owner) {
    var price = 0
    if(sell_which_token == config.ERC20.MKR) {
        price = sell_how_much.div(buy_how_much).toNumber()
    }
    else if(sell_which_token == config.ERC20.ETH) {
        price = buy_how_much.div(sell_how_much).toNumber()
    }
    
    var newOffer = {
        id: id,
        owner: owner,
        buy_which_token: buy_which_token,
        sell_which_token: sell_which_token,
        sell_how_much: sell_how_much.toString(10),
        buy_how_much: buy_how_much.toString(10),
        price: price
    }
    
    if(sell_which_token == config.ERC20.ETH && buy_which_token == config.ERC20.MKR) {
        var currentOffer = asks.find(function(offer) {
            return offer.id === newOffer.id
        })
        
        if(currentOffer == null) {
            asks.add(newOffer)    
        }
        else
        {
            currentOffer.buy_how_much = buy_how_much.toString(10)
            currentOffer.sell_how_much = sell_how_much.toString(10)
            currentOffer.price = newOffer.price
        }
    }
    else if(sell_which_token == config.ERC20.MKR && buy_which_token == config.ERC20.ETH) {
        var currentOffer = bids.find(function(offer) {
            return offer.id === newOffer.id
        })
        
        if(currentOffer == null) {
            bids.add(newOffer)    
        }
        else
        {
            currentOffer.buy_how_much = buy_how_much.toString(10)
            currentOffer.sell_how_much = sell_how_much.toString(10)
            currentOffer.price = newOffer.price
        }
    }
}

function removeOffer(offer_id, sell_which_token) {
    if(sell_which_token == config.ERC20.ETH) {
        asks.remove(function(offer) { return offer.id === offer_id})
    }
    else if(sell_which_token == config.ERC20.MKR) {
        bids.remove(function(offer) { return offer.id === offer_id})
    }
}

function checkQuantities() {
    Dapple.objects.matcher.OfferProperties(function (error, result) {
        if(!error) {
            console.log('Offer properties')
            console.log('Buy how much result: ' + result.args.buy_how_much.toNumber())
            console.log('Sell how much result: ' + result.args.sell_how_much.toNumber()) 
        }
    })
    Dapple.objects.matcher.Quantities(function (error, result) {
        if(!error) {
            console.log('Quantities')
            console.log(result.args.ask_quantity.toString(), result.args.buy_quantity.toString()) 
        }
    })
    Dapple.objects.matcher.TradeQuantityParameters(function (error, result) {
        if(!error) {
            console.log('Trade quantity parameters')
            console.log(result.args.bid_buy_how_much.toString(), result.args.bid_sell_how_much.toString(),
            result.args.ask_buy_how_much, result.args.ask_sell_how_much, result.args.balance) 
        }
    })
}

function showBalance() {
    Dapple.objects.matcher.balanceOf(config.ERC20.ETH, function(error, result) {
        if(!error) {
            console.log('ETH balance: ', result.toString())
        } 
        else {
            console.log('Error: ', error)
        }
    })
    Dapple.objects.matcher.balanceOf(config.ERC20.MKR, function(error, result) {
        if(!error) {
            console.log('MKR balance: ', result.toString())
        } 
        else {
            console.log('Error: ', error)
        }
    })
}

function sortOffers() {
    //sort for the highest bid prices
    bids.sort(function(a,b) {
        return b.price - a.price
    })
    
    //sort for the lowest ask price
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