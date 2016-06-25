var config = {};

config.ERC20 = {};
config.ERC20.ETH = {};
config.ERC20.ETH.address =  '0x52fe88b987c7829e5d5a61c98f67c9c14e6a7a90';
config.ERC20.ETH.name = 'ETH';
config.ERC20.MKR = {};
config.ERC20.MKR.address = '0xffb1c99b389ba527a9194b1606b3565a07da3eef';
config.ERC20.MKR.name = 'MKR';
config.base_currency = {};
config.base_currency.address = config.ERC20.MKR.address;
config.base_currency.name = config.ERC20.MKR.name;
config.quote_currency = {};
config.quote_currency.address = config.ERC20.ETH.address;
config.quote_currency.name = config.ERC20.ETH.name;

config.trade_gas_costs = 500000;
config.trade_gas_costs_zero = 0

module.exports = config;