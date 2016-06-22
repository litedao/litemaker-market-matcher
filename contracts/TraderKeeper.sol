import 'maker-otc/simple_market.sol';
import 'maker-otc/assertive.sol';
import 'erc20/erc20.sol';

contract TraderKeeper is Assertive {
    
    address owner;
    
    function TraderKeeper () {
        owner = msg.sender;
    }
    
    function withdraw(ERC20 token, uint token_amount) {
        assert(msg.sender == owner);
        assert(token.transfer(msg.sender, token_amount));
    }
    
    function deposit(ERC20 token, uint token_amount) {
        assert(msg.sender == owner);
        assert(token.transferFrom(msg.sender, this, token_amount));
    }
    
    function balanceOf(ERC20 token) constant returns (uint) {
        return token.balanceOf(this);
    }
    
    function approve(ERC20 token, uint amount, SimpleMarket maker_address) {
        token.approve(maker_address, amount);
    }
    
    //initially only the amount that was bought can be sold, so quantity is the same for bid/ask
    function trade(uint bid_id, uint ask_id, ERC20 buying, ERC20 selling, SimpleMarket maker_address) {
        assert(msg.sender == owner);
        
        var (bid_sell_how_much, bid_buy_how_much) = getOffer(bid_id, maker_address);
        //@info bid_buy_how_much `uint bid_buy_how_much` and bid_sell_how_much `uint bid_sell_how_much`        
        var (ask_sell_how_much, ask_buy_how_much) = getOffer(ask_id, maker_address);        
        //@info ask_buy_how_much `uint ask_buy_how_much` and ask_sell_how_much `uint ask_sell_how_much`        
        var (ask_quantity, bid_quantity) = determineTradeQuantity(bid_buy_how_much, bid_sell_how_much, ask_buy_how_much, ask_sell_how_much, balanceOf(buying));
        //@info bidquantity `uint bid_quantity` and askquantity `uint ask_quantity`
        //Check if the keeper has enough balance for the trades
        //var ask_total_price = (ask_buy_how_much / ask_sell_how_much) * ask_quantity; 
        selling.approve(maker_address, (ask_buy_how_much / ask_sell_how_much) * ask_quantity);
        //assert(balance_keeper_buying >= ask_total_price);
        checkBalanceAndAllowance(ask_buy_how_much, ask_sell_how_much, ask_quantity, selling, maker_address);
        
        assert(maker_address.buyPartial(ask_id, ask_quantity));
        
        var bid_total_price = bid_quantity / (bid_sell_how_much / bid_buy_how_much);
        //@info bid_total_price `uint bid_total_price`
        buying.approve(maker_address, bid_total_price);
        
        checkBalanceAndAllowance(bid_buy_how_much, bid_sell_how_much, bid_quantity, buying, maker_address);
        
        assert(maker_address.buyPartial(bid_id, bid_quantity));
    }
    
    function checkBalanceAndAllowance(uint buy_how_much, uint sell_how_much, uint quantity, ERC20 token, SimpleMarket maker_address) {
        var total_price = buy_how_much / sell_how_much * quantity;
        var balance = balanceOf(token);
        assert(balance >= total_price);
        
        var allowance = token.allowance(this, maker_address);
        if(allowance < total_price) {
            token.approve(maker_address, total_price);
        }
    }
    
    function getOffer(uint id, SimpleMarket maker_address) constant returns (uint, uint) {
        var (sell_how_much, sell_which_token, buy_how_much, buy_which_token) = maker_address.getOffer(id);
        return (sell_how_much, buy_how_much);
    }
    
    function determineTradeQuantity(uint bid_buy_how_much, uint bid_sell_how_much, uint ask_buy_how_much, uint ask_sell_how_much, uint balance) constant returns (uint askQuantity, uint bidQuantity) {
        //@info bid_buy_how_much `uint bid_buy_how_much` and bid_sell_how_much `uint bid_sell_how_much` and ask_buy_how_much `uint ask_buy_how_much` and ask_sell_how_much `uint ask_sell_how_much` and balance `uint balance`
        var minimum_ask_bid = minimum(bid_buy_how_much, ask_sell_how_much);
        //@info minimum_ask_bid `uint minimum_ask_bid`                
        var amount_before_balance = minimum_ask_bid * (ask_buy_how_much / ask_sell_how_much);
        //@info amount_before_balance `uint amount_before_balance`                
        var amount = minimum(balance, amount_before_balance);
        //@info amount `uint amount`                
        var ask_quantity = minimum_ask_bid * (amount / amount_before_balance);
        //@info ask_quantity `uint ask_quantity`                
        return (ask_quantity, ask_quantity * (bid_sell_how_much / bid_buy_how_much));
    }
    
    function minimum(uint a, uint b) constant returns (uint minimum) {
        if (a < b) {
            return a;    
        } 
        else {
            return b;
        }
    }
}

contract TraderKeeperMarket is SimpleMarket {}