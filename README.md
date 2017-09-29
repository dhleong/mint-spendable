spendable [![npm](https://img.shields.io/npm/v/mint-spendable.svg)](https://www.npmjs.com/package/mint-spendable)
=========

*Check how much you can spend*

## What

Spendable is a CLI app that interacts with your [Mint][1] account data to
calculate how much money you're spending on average, and how much you *should*
be spending to meet your budget.

It lets you take a more relaxed approach than the strictly-budgeted one that
[Mint][1] pushes, giving you a monthly "pool" of *spendable* money that *any*
spending subtracts from, so if you go a bit over-budget on food spending, for
example, but counter it by shopping less, you can still meet your "spendable"
goals.

## How

```
$ npm install -g mint-spendable
$ spendable
```

### Configuration

TK

### Security

Spendable attempts to securely store your credentials in the local keychain.
If that fails for whatever reason, they may get stored in the Configuration
JSON file (see above).

## Why

Until recently there was an app called LevelMoney that did this very well,
but after being acquired they got shut down. This app started as a very
simple, hacked-together script that attempted to provide a similar view of
my spending, and when I found I had some free time recently on some long
flights I decided to clean it up and make it a bit fancier.


[1]: https://www.mint.com
