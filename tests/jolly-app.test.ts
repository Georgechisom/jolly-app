import { describe, expect, it, beforeEach } from "vitest";
import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;
const wallet3 = accounts.get("wallet_3")!;

describe("jolly-app contract tests", () => {
  beforeEach(() => {
    // Initialize contract owner before each test
    const initOwner = simnet.callPublicFn(
      "jolly-app",
      "init-owner",
      [Cl.principal(deployer), Cl.principal(deployer)],
      deployer
    );
    expect(initOwner.result).toBeOk(Cl.bool(true));
  });

  describe("Initialization", () => {
    it("should initialize contract owner correctly", () => {
      const owner = simnet.callReadOnlyFn(
        "jolly-app",
        "get-contract-owner",
        [],
        deployer
      );
      expect(owner.result).toBeOk(Cl.principal(deployer));
    });

    it("should not allow re-initialization", () => {
      const reinit = simnet.callPublicFn(
        "jolly-app",
        "init-owner",
        [Cl.principal(wallet1), Cl.principal(wallet1)],
        deployer
      );
      expect(reinit.result).toBeErr(Cl.uint(100)); // ERR-NOT-AUTHORIZED
    });

    it("should start with zero posts", () => {
      const lastPostId = simnet.callReadOnlyFn(
        "jolly-app",
        "get-last-post-id",
        [],
        wallet1
      );
      expect(lastPostId.result).toBeOk(Cl.uint(0));
    });

    it("should start with zero platform fees", () => {
      const fees = simnet.callReadOnlyFn(
        "jolly-app",
        "get-platform-fees",
        [],
        wallet1
      );
      expect(fees.result).toBeOk(Cl.uint(0));
    });
  });

  describe("Post Creation", () => {
    it("should create a post with metadata", () => {
      const content = Cl.stringUtf8("Hello, Stacks!");
      const metadata = Cl.some(Cl.stringAscii("Test metadata"));

      const createPost = simnet.callPublicFn(
        "jolly-app",
        "create-post",
        [content, metadata],
        wallet1
      );

      expect(createPost.result).toBeOk(Cl.uint(1));

      // Verify post was created
      const post = simnet.callReadOnlyFn(
        "jolly-app",
        "get-post",
        [Cl.uint(1)],
        wallet1
      );

      expect(post.result).toBeSome(
        Cl.tuple({
          content: Cl.stringUtf8("Hello, Stacks!"),
          owner: Cl.principal(wallet1),
          metadata: Cl.some(Cl.stringAscii("Test metadata")),
          timestamp: Cl.uint(simnet.blockHeight),
        })
      );
    });

    it("should create a post without metadata (uses tx-sender as metadata)", () => {
      const content = Cl.stringUtf8("Post without metadata");
      const metadata = Cl.none();

      const createPost = simnet.callPublicFn(
        "jolly-app",
        "create-post",
        [content, metadata],
        wallet1
      );

      expect(createPost.result).toBeOk(Cl.uint(1));

      // Post should have wallet1 principal as metadata
      const post = simnet.callReadOnlyFn(
        "jolly-app",
        "get-post",
        [Cl.uint(1)],
        wallet1
      );

      const postData = Cl.prettyPrint(post.result);
      expect(postData).toContain(wallet1);
    });

    it("should reject post content longer than MAX_POST_CONTENT_LEN", () => {
      const longContent = Cl.stringUtf8("a".repeat(501)); // Max is 500
      const metadata = Cl.none();

      const createPost = simnet.callPublicFn(
        "jolly-app",
        "create-post",
        [longContent, metadata],
        wallet1
      );

      expect(createPost.result).toBeErr(Cl.uint(101)); // ERR-INVALID-AMOUNT
    });

    it("should increment post IDs correctly", () => {
      const content = Cl.stringUtf8("Post 1");
      const metadata = Cl.none();

      // Create first post
      const post1 = simnet.callPublicFn(
        "jolly-app",
        "create-post",
        [content, metadata],
        wallet1
      );
      expect(post1.result).toBeOk(Cl.uint(1));

      // Create second post
      const post2 = simnet.callPublicFn(
        "jolly-app",
        "create-post",
        [content, metadata],
        wallet1
      );
      expect(post2.result).toBeOk(Cl.uint(2));

      // Verify last post ID
      const lastPostId = simnet.callReadOnlyFn(
        "jolly-app",
        "get-last-post-id",
        [],
        wallet1
      );
      expect(lastPostId.result).toBeOk(Cl.uint(2));
    });
  });

  describe("Post Tipping", () => {
    beforeEach(() => {
      // Create a post for tipping tests
      simnet.callPublicFn(
        "jolly-app",
        "create-post",
        [Cl.stringUtf8("Test post"), Cl.none()],
        wallet1
      );
    });

    it("should tip a post successfully", () => {
      const tipAmount = 1000000; // 1 STX in microstacks

      const tip = simnet.callPublicFn(
        "jolly-app",
        "tip-post",
        [Cl.uint(1), Cl.uint(tipAmount)],
        wallet2
      );

      expect(tip.result).toBeOk(Cl.bool(true));

      // Verify tip amount was recorded
      const tips = simnet.callReadOnlyFn(
        "jolly-app",
        "get-post-tips",
        [Cl.uint(1)],
        wallet2
      );
      expect(tips.result).toBeUint(tipAmount);
    });

    it("should calculate and transfer 5% platform fee", () => {
      const tipAmount = 1000000; // 1 STX
      const platformFee = 50000; // 5% = 0.05 STX

      const tip = simnet.callPublicFn(
        "jolly-app",
        "tip-post",
        [Cl.uint(1), Cl.uint(tipAmount)],
        wallet2
      );

      expect(tip.result).toBeOk(Cl.bool(true));

      // Check platform fees were accumulated
      const fees = simnet.callReadOnlyFn(
        "jolly-app",
        "get-platform-fees",
        [],
        wallet2
      );
      expect(fees.result).toBeOk(Cl.uint(platformFee));
    });

    it("should reject zero amount tips", () => {
      const tip = simnet.callPublicFn(
        "jolly-app",
        "tip-post",
        [Cl.uint(1), Cl.uint(0)],
        wallet2
      );

      expect(tip.result).toBeErr(Cl.uint(101)); // ERR-INVALID-AMOUNT
    });

    it("should reject tips for non-existent posts", () => {
      const tip = simnet.callPublicFn(
        "jolly-app",
        "tip-post",
        [Cl.uint(999), Cl.uint(1000000)],
        wallet2
      );

      expect(tip.result).toBeErr(Cl.uint(102)); // ERR-POST-NOT-FOUND
    });

    it("should accumulate tips from multiple users", () => {
      const tipAmount = 1000000;

      // First tip
      simnet.callPublicFn(
        "jolly-app",
        "tip-post",
        [Cl.uint(1), Cl.uint(tipAmount)],
        wallet2
      );

      // Second tip
      simnet.callPublicFn(
        "jolly-app",
        "tip-post",
        [Cl.uint(1), Cl.uint(tipAmount)],
        wallet3
      );

      // Verify total tips
      const tips = simnet.callReadOnlyFn(
        "jolly-app",
        "get-post-tips",
        [Cl.uint(1)],
        wallet1
      );
      expect(tips.result).toBeUint(tipAmount * 2);
    });
  });

  describe("Post Management", () => {
    beforeEach(() => {
      // Create a post for management tests
      simnet.callPublicFn(
        "jolly-app",
        "create-post",
        [Cl.stringUtf8("Test post"), Cl.none()],
        wallet1
      );
    });

    it("should delete own post", () => {
      const deletePost = simnet.callPublicFn(
        "jolly-app",
        "delete-post",
        [Cl.uint(1)],
        wallet1
      );

      expect(deletePost.result).toBeOk(Cl.bool(true));

      // Verify post was deleted
      const post = simnet.callReadOnlyFn(
        "jolly-app",
        "get-post",
        [Cl.uint(1)],
        wallet1
      );
      expect(post.result).toBeNone();
    });

    it("should not allow deleting other user's post", () => {
      const deletePost = simnet.callPublicFn(
        "jolly-app",
        "delete-post",
        [Cl.uint(1)],
        wallet2
      );

      expect(deletePost.result).toBeErr(Cl.uint(100)); // ERR-NOT-AUTHORIZED
    });

    it("should update own post content", () => {
      const newContent = Cl.stringUtf8("Updated content");

      const updatePost = simnet.callPublicFn(
        "jolly-app",
        "update-post",
        [Cl.uint(1), newContent],
        wallet1
      );

      expect(updatePost.result).toBeOk(Cl.bool(true));

      // Verify content was updated
      const post = simnet.callReadOnlyFn(
        "jolly-app",
        "get-post",
        [Cl.uint(1)],
        wallet1
      );

      expect(post.result).toBeSome(
        Cl.tuple({
          content: Cl.stringUtf8("Updated content"),
          owner: Cl.principal(wallet1),
          metadata: Cl.some(Cl.standardPrincipal(wallet1)),
          timestamp: Cl.uint(simnet.blockHeight),
        })
      );
    });

    it("should not allow updating other user's post", () => {
      const newContent = Cl.stringUtf8("Hacked content");

      const updatePost = simnet.callPublicFn(
        "jolly-app",
        "update-post",
        [Cl.uint(1), newContent],
        wallet2
      );

      expect(updatePost.result).toBeErr(Cl.uint(100)); // ERR-NOT-AUTHORIZED
    });

    it("should transfer post ownership", () => {
      const transferPost = simnet.callPublicFn(
        "jolly-app",
        "transfer-post",
        [Cl.uint(1), Cl.principal(wallet2)],
        wallet1
      );

      expect(transferPost.result).toBeOk(Cl.bool(true));

      // Verify new owner
      const owner = simnet.callReadOnlyFn(
        "jolly-app",
        "get-owner",
        [Cl.uint(1)],
        wallet1
      );
      expect(owner.result).toBeOk(Cl.some(Cl.principal(wallet2)));
    });

    it("should not allow transferring other user's post", () => {
      const transferPost = simnet.callPublicFn(
        "jolly-app",
        "transfer-post",
        [Cl.uint(1), Cl.principal(wallet3)],
        wallet2
      );

      expect(transferPost.result).toBeErr(Cl.uint(100)); // ERR-NOT-AUTHORIZED
    });
  });

  describe("Batch Operations", () => {
    it("should create multiple posts in batch", () => {
      const posts = Cl.list([
        Cl.tuple({
          content: Cl.stringUtf8("Post 1"),
          metadata: Cl.none(),
        }),
        Cl.tuple({
          content: Cl.stringUtf8("Post 2"),
          metadata: Cl.some(Cl.stringAscii("metadata2")),
        }),
        Cl.tuple({
          content: Cl.stringUtf8("Post 3"),
          metadata: Cl.none(),
        }),
      ]);

      const batchCreate = simnet.callPublicFn(
        "jolly-app",
        "batch-create-posts",
        [posts],
        wallet1
      );

      expect(batchCreate.result).toBeOk(
        Cl.list([Cl.uint(1), Cl.uint(2), Cl.uint(3)])
      );

      // Verify all posts were created
      const lastPostId = simnet.callReadOnlyFn(
        "jolly-app",
        "get-last-post-id",
        [],
        wallet1
      );
      expect(lastPostId.result).toBeOk(Cl.uint(3));
    });

    it("should retrieve multiple posts in batch", () => {
      // Create posts
      simnet.callPublicFn(
        "jolly-app",
        "create-post",
        [Cl.stringUtf8("Post 1"), Cl.none()],
        wallet1
      );
      simnet.callPublicFn(
        "jolly-app",
        "create-post",
        [Cl.stringUtf8("Post 2"), Cl.none()],
        wallet1
      );

      const postIds = Cl.list([Cl.uint(1), Cl.uint(2)]);

      const batchGet = simnet.callReadOnlyFn(
        "jolly-app",
        "get-posts-batch",
        [postIds],
        wallet1
      );

      expect(batchGet.result).toBeOk(
        Cl.list([
          Cl.some(
            Cl.tuple({
              content: Cl.stringUtf8("Post 1"),
              owner: Cl.principal(wallet1),
              metadata: Cl.some(Cl.standardPrincipal(wallet1)),
              timestamp: Cl.uint(simnet.blockHeight - 1),
            })
          ),
          Cl.some(
            Cl.tuple({
              content: Cl.stringUtf8("Post 2"),
              owner: Cl.principal(wallet1),
              metadata: Cl.some(Cl.standardPrincipal(wallet1)),
              timestamp: Cl.uint(simnet.blockHeight),
            })
          ),
        ])
      );
    });
  });

  describe("Helper Functions", () => {
    beforeEach(() => {
      simnet.callPublicFn(
        "jolly-app",
        "create-post",
        [Cl.stringUtf8("Test post"), Cl.none()],
        wallet1
      );
    });

    it("should check if user is post owner", () => {
      const isOwner = simnet.callReadOnlyFn(
        "jolly-app",
        "is-post-owner",
        [Cl.uint(1), Cl.principal(wallet1)],
        wallet2
      );
      expect(isOwner.result).toBeOk(Cl.bool(true));

      const isNotOwner = simnet.callReadOnlyFn(
        "jolly-app",
        "is-post-owner",
        [Cl.uint(1), Cl.principal(wallet2)],
        wallet2
      );
      expect(isNotOwner.result).toBeOk(Cl.bool(false));
    });

    it("should get post with tips in one call", () => {
      // Add a tip
      simnet.callPublicFn(
        "jolly-app",
        "tip-post",
        [Cl.uint(1), Cl.uint(1000000)],
        wallet2
      );

      const postWithTips = simnet.callReadOnlyFn(
        "jolly-app",
        "get-post-with-tips",
        [Cl.uint(1)],
        wallet1
      );

      expect(postWithTips.result).toBeOk(
        Cl.tuple({
          post: Cl.tuple({
            content: Cl.stringUtf8("Test post"),
            owner: Cl.principal(wallet1),
            metadata: Cl.some(Cl.standardPrincipal(wallet1)),
            timestamp: Cl.uint(simnet.blockHeight - 1),
          }),
          tips: Cl.uint(1000000),
        })
      );
    });
  });

  describe("Platform Fee Withdrawal", () => {
    beforeEach(() => {
      // Create post and add tips to accumulate fees
      simnet.callPublicFn(
        "jolly-app",
        "create-post",
        [Cl.stringUtf8("Test post"), Cl.none()],
        wallet1
      );
      simnet.callPublicFn(
        "jolly-app",
        "tip-post",
        [Cl.uint(1), Cl.uint(1000000)],
        wallet2
      );
    });

    it("should allow owner to withdraw platform fees", () => {
      const fees = simnet.callReadOnlyFn(
        "jolly-app",
        "get-platform-fees",
        [],
        deployer
      );
      const feeAmount = 50000; // 5% of 1000000

      expect(fees.result).toBeOk(Cl.uint(feeAmount));

      const withdraw = simnet.callPublicFn(
        "jolly-app",
        "withdraw-fees",
        [Cl.uint(feeAmount)],
        deployer
      );

      expect(withdraw.result).toBeOk(Cl.bool(true));

      // Verify fees were deducted
      const newFees = simnet.callReadOnlyFn(
        "jolly-app",
        "get-platform-fees",
        [],
        deployer
      );
      expect(newFees.result).toBeOk(Cl.uint(0));
    });

    it("should not allow non-owner to withdraw fees", () => {
      const withdraw = simnet.callPublicFn(
        "jolly-app",
        "withdraw-fees",
        [Cl.uint(50000)],
        wallet1
      );

      expect(withdraw.result).toBeErr(Cl.uint(100)); // ERR-NOT-AUTHORIZED
    });

    it("should not allow withdrawing more than available fees", () => {
      const withdraw = simnet.callPublicFn(
        "jolly-app",
        "withdraw-fees",
        [Cl.uint(1000000)], // More than the 50000 available
        deployer
      );

      expect(withdraw.result).toBeErr(Cl.uint(103)); // ERR-INSUFFICIENT-BALANCE
    });
  });

  describe("SIP-009 NFT Standard Compliance", () => {
    beforeEach(() => {
      simnet.callPublicFn(
        "jolly-app",
        "create-post",
        [Cl.stringUtf8("NFT Post"), Cl.some(Cl.stringAscii("NFT metadata"))],
        wallet1
      );
    });

    it("should get last token ID", () => {
      const lastTokenId = simnet.callReadOnlyFn(
        "jolly-app",
        "get-last-token-id",
        [],
        wallet1
      );
      expect(lastTokenId.result).toBeOk(Cl.uint(1));
    });

    it("should get token URI", () => {
      const tokenUri = simnet.callReadOnlyFn(
        "jolly-app",
        "get-token-uri",
        [Cl.uint(1)],
        wallet1
      );
      expect(tokenUri.result).toBeOk(
        Cl.some(Cl.some(Cl.stringAscii("NFT metadata")))
      );
    });

    it("should get token owner", () => {
      const owner = simnet.callReadOnlyFn(
        "jolly-app",
        "get-owner",
        [Cl.uint(1)],
        wallet1
      );
      expect(owner.result).toBeOk(Cl.some(Cl.principal(wallet1)));
    });
  });
});
