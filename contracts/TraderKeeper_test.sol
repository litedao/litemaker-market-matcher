import 'dapple/test.sol';
import 'TraderKeeper.sol';
import 'erc20/base.sol';
import 'maker-otc/simple_market.sol';
import 'maker-otc/assertive.sol';

contract KeeperTester is Tester {
    SimpleMarket market;
    
    function KeeperTester(SimpleMarket simpleMarket) {
        market = simpleMarket;
    }
    
    function doApprove(ERC20 which_token, uint amount) constant returns (bool ok) {
        return which_token.approve(market, amount);
    }
    
    function doOffer(uint sell_how_much, ERC20 sell_which_token, uint buy_how_much, ERC20 buy_which_token) returns (uint id) {
        return market.offer(sell_how_much, sell_which_token, buy_how_much, buy_which_token);
    }
    
    function doWithdraw(ERC20 token, uint token_amount, TraderKeeper keeper) {
        keeper.withdraw(token, token_amount);
    }
    
    function getOffer(uint id) constant returns (uint sell_how_much, ERC20 sell_which_token, uint buy_how_much, ERC20 buy_which_token) {
        return market.getOffer(id);
    }
}

contract TraderKeeperTest is Test {
    TraderKeeper keeper;
    KeeperTester buyer;
    KeeperTester seller;
    ERC20 token1;
    ERC20 token2;
    SimpleMarket simple_market;
    
    uint constant initial_balance_t1 = 1600000000000000000000;
    uint constant initial_balance_t2 = 1200000000000000000000;
    uint constant initial_balance_keeper_t1 = 600000000000000000;
    uint constant initial_balance_keeper_t2 = 2000000000000000000;
    uint constant initial_balance_buyer_t1 = 600000000000000000;
    uint constant initial_balance_buyer_t2 = 2000000000000000000;
    uint constant initial_balance_seller_t1 = 400000000000000000;
    uint constant initial_balance_seller_t2 = 2000000000000000000;
    uint constant buyer_token1_bid = 100;
    uint constant seller_token2_ask = 1000;
    uint constant bid_sell_how_much = 600000000000000000;
    uint constant bid_buy_how_much = 2000000000000000000;
    uint constant ask_sell_how_much = 2000000000000000000;
    uint constant ask_buy_how_much = 400000000000000000;
    uint bid_id_first;
    uint ask_id_first;
    
    function setUp() {
        simple_market = new SimpleMarket();
        buyer = new KeeperTester(simple_market);
        seller = new KeeperTester(simple_market); 
        
        token1 = new ERC20Base(initial_balance_t1);
        token2 = new ERC20Base(initial_balance_t2);
        
        token1.transfer(buyer, initial_balance_buyer_t1);
        token1.transfer(seller, initial_balance_seller_t1);
        token2.transfer(buyer, initial_balance_buyer_t2);
        token2.transfer(seller, initial_balance_seller_t2);
        
        keeper = new TraderKeeper();
       
        token1.transfer(keeper, initial_balance_keeper_t1);
        token2.transfer(keeper, initial_balance_keeper_t2);
        token1.approve(simple_market, initial_balance_keeper_t1);
        token2.approve(simple_market, initial_balance_keeper_t2);
        keeper.approve(token1, initial_balance_keeper_t1, simple_market);
        keeper.approve(token2, initial_balance_keeper_t2, simple_market);
        
        //create bids and asks        
        buyer.doApprove(token1, initial_balance_buyer_t1);
        buyer.doApprove(token2, initial_balance_buyer_t2);
        seller.doApprove(token1, initial_balance_seller_t1);
        seller.doApprove(token2, initial_balance_seller_t2);
        bid_id_first = buyer.doOffer(bid_sell_how_much, token1, bid_buy_how_much, token2);
        ask_id_first = seller.doOffer(ask_sell_how_much, token2, ask_buy_how_much, token1);
    }
    
    function testSetUp() {
        assertEq(buyer.doApprove(token1, buyer_token1_bid), true);
        assertEq(seller.doApprove(token2, seller_token2_ask), true);
        assertEq(token1.approve(simple_market, initial_balance_keeper_t1), true);
        assertEq(token2.approve(simple_market, initial_balance_keeper_t2), true);
        assertEq(token1.balanceOf(keeper), initial_balance_keeper_t1);
        assertEq(token2.balanceOf(keeper), initial_balance_keeper_t2);
        assertEq(token1.balanceOf(buyer), initial_balance_buyer_t1 - bid_sell_how_much);
        assertEq(token1.balanceOf(seller), initial_balance_seller_t1);
        assertEq(token2.balanceOf(buyer), initial_balance_buyer_t2);
        assertEq(token2.balanceOf(seller), initial_balance_seller_t2 - ask_sell_how_much);
        assertEq(bid_id_first, 1);
        assertEq(ask_id_first, 2);
    }
    
    function testQuantities() {
        var bid_buy_how_much = 2000000000000000000;
        var bid_sell_how_much = 600000000000000000;
        var ask_buy_how_much = 400000000000000000;
        var ask_sell_how_much = 2000000000000000000;
        var balance = 26000000000000000000;
        var (ask_quantity, bid_quantity) = keeper.determineTradeQuantity(bid_buy_how_much, bid_sell_how_much, ask_buy_how_much,
        ask_sell_how_much, balance);
        assertEq(ask_quantity, 2000000000000000000);
        assertEq(bid_quantity, 600000000000000000);
    }
    
    function testOffer() {
        var (sell_how_much, buy_how_much) = keeper.getOffer(1, simple_market);
        assertEq(buy_how_much, 2000000000000000000);
        assertEq(sell_how_much, 600000000000000000); 
    }
    
    function testDeposit() {
        uint deposit_amount = 300;
        token1.approve(keeper, deposit_amount);
        keeper.deposit(token1, deposit_amount);
        assertEq(token1.balanceOf(keeper), initial_balance_keeper_t1 + deposit_amount);
    }
    
    function testFailDepositInsufficientFunds() {
        uint deposit_amount = 10000000;
        keeper.deposit(token1, deposit_amount);
    }
    
    function testWithdraw() {
        uint withdraw_amount = 500;
        keeper.withdraw(token2, withdraw_amount);
        assertEq(token2.balanceOf(keeper), initial_balance_keeper_t2 - withdraw_amount);
    }
    
    function testFailWithdrawInsufficientFunds() {
        uint withdraw_amount = 1000000;
        keeper.withdraw(token2, initial_balance_keeper_t2 * 100);
    }
    
    function testFailIsOwner() {
        buyer.doWithdraw(token1, 100, keeper);
    }   
    
    function testTrade() {
        keeper.trade(bid_id_first, ask_id_first, token2, token1, simple_market);
    }
    
    function testFailTradeBuy() {
        keeper.trade(0, ask_id_first, token2, token1, simple_market);
    }
    
    function testFailTradeSell() {
        keeper.trade(bid_id_first, 0, token2, token1, simple_market);
    }
    
    function testFailInsufficientBalance() {
        keeper.withdraw(token2, initial_balance_keeper_t2);
        assertEq(token2.balanceOf(keeper), 0);
        keeper.trade(bid_id_first, ask_id_first, token1, token2, simple_market);
    }
}