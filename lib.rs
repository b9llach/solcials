use anchor_lang::prelude::*;

declare_id!("2dMkuyNN2mUiSWyW1UGTRE7CkfULpudVdMCbASCChLpv");

#[program]
pub mod social {
    use super::*;

    pub fn initialize(_ctx: Context<Initialize>) -> Result<()> {
        msg!("Initializing Solcials - Decentralized Social Media on Solana!");
        Ok(())
    }

    // Create a text post (with platform fee)
    pub fn create_text_post(
        ctx: Context<CreateTextPost>,
        content: String,
        timestamp: i64,
        reply_to: Option<Pubkey>,
    ) -> Result<()> {
        let post = &mut ctx.accounts.post;

        // Validate content length
        require!(content.len() <= 280, SocialError::ContentTooLong);
        require!(content.len() > 0, SocialError::ContentEmpty);

        // Calculate and collect 1% platform fee for text posts
        let total_rent = post.to_account_info().lamports();
        let platform_fee = total_rent / 100; // 1% of storage cost
        
        transfer_lamports(
            &ctx.accounts.author.to_account_info(),
            &ctx.accounts.platform_treasury.to_account_info(),
            platform_fee,
        )?;

        post.author = ctx.accounts.author.key();
        post.content = content;
        post.post_type = 0; // 0 = text post
        post.image_nft = None;
        post.reply_to = reply_to;
        post.timestamp = timestamp; // Use provided timestamp
        post.likes = 0;
        post.reposts = 0;
        post.replies = 0;
        post.bump = ctx.bumps.post;

        // Update user's post count
        ctx.accounts.user_profile.post_count += 1;

        msg!("Text post created by: {} with platform fee: {}", ctx.accounts.author.key(), platform_fee);
        Ok(())
    }

    // Create an image post with cNFT reference (premium with 10% platform fee)
    pub fn create_image_post(
        ctx: Context<CreateImagePost>,
        content: String,
        timestamp: i64,
        reply_to: Option<Pubkey>,
    ) -> Result<()> {
        let post = &mut ctx.accounts.post;

        // Validate content length
        require!(content.len() <= 280, SocialError::ContentTooLong);
        require!(content.len() > 0, SocialError::ContentEmpty);

        // Calculate and collect 10% platform fee
        let total_rent = post.to_account_info().lamports();
        let platform_fee = total_rent / 10; // 10% of storage cost
        
        transfer_lamports(
            &ctx.accounts.author.to_account_info(),
            &ctx.accounts.platform_treasury.to_account_info(),
            platform_fee,
        )?;

        post.author = ctx.accounts.author.key();
        post.content = content;
        post.post_type = 1; // 1 = image post
        post.image_nft = None; // Will be set when NFT is linked
        post.reply_to = reply_to;
        post.timestamp = timestamp; // Use provided timestamp
        post.likes = 0;
        post.reposts = 0;
        post.replies = 0;
        post.bump = ctx.bumps.post;

        // Update user's post count
        ctx.accounts.user_profile.post_count += 1;

        msg!("Image post created by: {} with platform fee: {}", ctx.accounts.author.key(), platform_fee);
        Ok(())
    }

    // Link cNFT to existing image post
    pub fn link_cnft_to_post(
        ctx: Context<LinkCNftToPost>,
        cnft_address: Pubkey,
    ) -> Result<()> {
        let post = &mut ctx.accounts.post;
        
        // Verify this is an image post
        require!(post.post_type == 1, SocialError::NotImagePost);
        
        // Link the cNFT
        post.image_nft = Some(cnft_address);
        
        msg!("cNFT {} linked to post {}", cnft_address, post.key());
        Ok(())
    }

    // Follow a user
    pub fn follow_user(ctx: Context<FollowUser>) -> Result<()> {
        let follow_account = &mut ctx.accounts.follow_account;
        let clock = Clock::get()?;

        follow_account.follower = ctx.accounts.follower.key();
        follow_account.following = ctx.accounts.following.key();
        follow_account.timestamp = clock.unix_timestamp;
        follow_account.bump = ctx.bumps.follow_account;

        // Update follower/following counts
        ctx.accounts.follower_profile.following_count += 1;
        ctx.accounts.following_profile.followers_count += 1;

        msg!("User {} followed {}", ctx.accounts.follower.key(), ctx.accounts.following.key());
        Ok(())
    }

    // Unfollow a user
    pub fn unfollow_user(_ctx: Context<UnfollowUser>) -> Result<()> {
        // The account will be closed and lamports returned
        msg!("User unfollowed successfully");
        Ok(())
    }

    // Like a post
    pub fn like_post(ctx: Context<LikePost>) -> Result<()> {
        let like_account = &mut ctx.accounts.like_account;
        let clock = Clock::get()?;

        like_account.user = ctx.accounts.user.key();
        like_account.post = ctx.accounts.post.key();
        like_account.timestamp = clock.unix_timestamp;
        like_account.bump = ctx.bumps.like_account;

        // Increment like count on post
        ctx.accounts.post.likes += 1;

        msg!("Post liked by: {}", ctx.accounts.user.key());
        Ok(())
    }

    // Unlike a post
    pub fn unlike_post(ctx: Context<UnlikePost>) -> Result<()> {
        // Decrement like count on post
        ctx.accounts.post.likes -= 1;
        msg!("Post unliked");
        Ok(())
    }

    // Initialize user profile
    pub fn initialize_user_profile(ctx: Context<InitializeUserProfile>) -> Result<()> {
        let profile = &mut ctx.accounts.user_profile;
        let clock = Clock::get()?;

        profile.user = ctx.accounts.user.key();
        profile.username = None;
        profile.display_name = None;
        profile.bio = None;
        profile.avatar_url = None;
        profile.cover_image_url = None;
        profile.website_url = None;
        profile.location = None;
        profile.followers_count = 0;
        profile.following_count = 0;
        profile.post_count = 0;
        profile.created_at = clock.unix_timestamp;
        profile.verified = false;
        profile.bump = ctx.bumps.user_profile;

        msg!("User profile created for: {}", ctx.accounts.user.key());
        Ok(())
    }

    // Update user profile
    pub fn update_user_profile(
        ctx: Context<UpdateUserProfile>,
        username: Option<String>,
        display_name: Option<String>,
        bio: Option<String>,
        avatar_url: Option<String>,
        cover_image_url: Option<String>,
        website_url: Option<String>,
        location: Option<String>,
    ) -> Result<()> {
        let profile = &mut ctx.accounts.user_profile;

        if let Some(username) = username {
            require!(username.len() <= 50, SocialError::UsernameTooLong);
            profile.username = Some(username);
        }

        if let Some(display_name) = display_name {
            require!(display_name.len() <= 50, SocialError::DisplayNameTooLong);
            profile.display_name = Some(display_name);
        }

        if let Some(bio) = bio {
            require!(bio.len() <= 160, SocialError::BioTooLong);
            profile.bio = Some(bio);
        }

        if let Some(avatar_url) = avatar_url {
            require!(avatar_url.len() <= 200, SocialError::AvatarUrlTooLong);
            profile.avatar_url = Some(avatar_url);
        }

        if let Some(cover_image_url) = cover_image_url {
            require!(cover_image_url.len() <= 200, SocialError::CoverImageUrlTooLong);
            profile.cover_image_url = Some(cover_image_url);
        }

        if let Some(website_url) = website_url {
            require!(website_url.len() <= 200, SocialError::WebsiteUrlTooLong);
            profile.website_url = Some(website_url);
        }

        if let Some(location) = location {
            require!(location.len() <= 100, SocialError::LocationTooLong);
            profile.location = Some(location);
        }

        msg!("User profile updated for: {}", ctx.accounts.user.key());
        Ok(())
    }
}

// Account Structures

#[account]
pub struct Post {
    pub author: Pubkey,
    pub content: String,
    pub post_type: u8, // 0 = text, 1 = image
    pub image_nft: Option<Pubkey>, // cNFT address for image posts
    pub reply_to: Option<Pubkey>,
    pub timestamp: i64,
    pub likes: u64,
    pub reposts: u64,
    pub replies: u64,
    pub bump: u8,
}

#[account]
pub struct UserProfile {
    pub user: Pubkey,
    pub username: Option<String>,
    pub display_name: Option<String>,  // Full name/display name
    pub bio: Option<String>,
    pub avatar_url: Option<String>,
    pub cover_image_url: Option<String>,  // Cover/banner image
    pub website_url: Option<String>,
    pub location: Option<String>,
    pub followers_count: u64,
    pub following_count: u64,
    pub post_count: u64,
    pub created_at: i64,
    pub verified: bool,  // For verification badges
    pub bump: u8,
}

#[account]
pub struct FollowRelation {
    pub follower: Pubkey,
    pub following: Pubkey,
    pub timestamp: i64,
    pub bump: u8,
}

#[account]
pub struct LikeRelation {
    pub user: Pubkey,
    pub post: Pubkey,
    pub timestamp: i64,
    pub bump: u8,
}

// Helper function for lamport transfers
fn transfer_lamports<'info>(
    from: &AccountInfo<'info>,
    to: &AccountInfo<'info>,
    amount: u64,
) -> Result<()> {
    let ix = anchor_lang::solana_program::system_instruction::transfer(
        from.key,
        to.key,
        amount,
    );
    
    anchor_lang::solana_program::program::invoke(
        &ix,
        &[from.clone(), to.clone()],
    )?;
    
    Ok(())
}

// Context Structures

#[derive(Accounts)]
pub struct Initialize {}

#[derive(Accounts)]
#[instruction(content: String, timestamp: i64)]
pub struct CreateTextPost<'info> {
    #[account(
        init,
        payer = author,
        space = 8 + 32 + 4 + 280 + 1 + 4 + 1 + 32 + 8 + 8 + 8 + 8 + 1, // Discriminator + author + content + post_type + empty chunks + total_chunks + reply_to + counters + bump
        seeds = [b"post", author.key().as_ref(), &timestamp.to_le_bytes()],
        bump
    )]
    pub post: Account<'info, Post>,

    #[account(
        mut,
        seeds = [b"user_profile", author.key().as_ref()],
        bump = user_profile.bump
    )]
    pub user_profile: Account<'info, UserProfile>,

    /// CHECK: Platform treasury account for collecting fees
    #[account(mut)]
    pub platform_treasury: AccountInfo<'info>,

    #[account(mut)]
    pub author: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(content: String, timestamp: i64)]
pub struct CreateImagePost<'info> {
    #[account(
        init,
        payer = author,
        space = 8 + 32 + 4 + 280 + 1 + 4 + 1 + 32 + 8 + 8 + 8 + 8 + 1, // Same as text post initially
        seeds = [b"post", author.key().as_ref(), &timestamp.to_le_bytes()],
        bump
    )]
    pub post: Account<'info, Post>,

    #[account(
        mut,
        seeds = [b"user_profile", author.key().as_ref()],
        bump = user_profile.bump
    )]
    pub user_profile: Account<'info, UserProfile>,

    /// CHECK: Platform treasury account for collecting fees
    #[account(mut)]
    pub platform_treasury: AccountInfo<'info>,

    #[account(mut)]
    pub author: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FollowUser<'info> {
    #[account(
        init,
        payer = follower,
        space = 8 + 32 + 32 + 8 + 1, // Account discriminator + 2 pubkeys + timestamp + bump
        seeds = [b"follow", follower.key().as_ref(), following.key().as_ref()],
        bump
    )]
    pub follow_account: Account<'info, FollowRelation>,

    #[account(
        mut,
        seeds = [b"user_profile", follower.key().as_ref()],
        bump = follower_profile.bump
    )]
    pub follower_profile: Account<'info, UserProfile>,

    #[account(
        mut,
        seeds = [b"user_profile", following.key().as_ref()],
        bump = following_profile.bump
    )]
    pub following_profile: Account<'info, UserProfile>,

    #[account(mut)]
    pub follower: Signer<'info>,
    /// CHECK: This is safe because we're only using it as a seed
    pub following: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UnfollowUser<'info> {
    #[account(
        mut,
        close = follower,
        seeds = [b"follow", follower.key().as_ref(), following.key().as_ref()],
        bump = follow_account.bump
    )]
    pub follow_account: Account<'info, FollowRelation>,

    #[account(
        mut,
        seeds = [b"user_profile", follower.key().as_ref()],
        bump = follower_profile.bump
    )]
    pub follower_profile: Account<'info, UserProfile>,

    #[account(
        mut,
        seeds = [b"user_profile", following.key().as_ref()],
        bump = following_profile.bump
    )]
    pub following_profile: Account<'info, UserProfile>,

    #[account(mut)]
    pub follower: Signer<'info>,
    /// CHECK: This is safe because we're only using it as a seed
    pub following: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct LikePost<'info> {
    #[account(
        init,
        payer = user,
        space = 8 + 32 + 32 + 8 + 1, // Account discriminator + 2 pubkeys + timestamp + bump
        seeds = [b"like", user.key().as_ref(), post.key().as_ref()],
        bump
    )]
    pub like_account: Account<'info, LikeRelation>,

    #[account(mut)]
    pub post: Account<'info, Post>,

    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UnlikePost<'info> {
    #[account(
        mut,
        close = user,
        seeds = [b"like", user.key().as_ref(), post.key().as_ref()],
        bump = like_account.bump
    )]
    pub like_account: Account<'info, LikeRelation>,

    #[account(mut)]
    pub post: Account<'info, Post>,

    #[account(mut)]
    pub user: Signer<'info>,
}

#[derive(Accounts)]
pub struct InitializeUserProfile<'info> {
    #[account(
        init,
        payer = user,
        space = 8 + 32 + 4 + 50 + 4 + 50 + 4 + 160 + 4 + 200 + 4 + 200 + 4 + 200 + 4 + 100 + 8 + 8 + 8 + 8 + 1 + 1, // Discriminator + pubkey + all optional strings with length prefixes + counters + verified + bump
        seeds = [b"user_profile", user.key().as_ref()],
        bump
    )]
    pub user_profile: Account<'info, UserProfile>,

    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateUserProfile<'info> {
    #[account(
        mut,
        seeds = [b"user_profile", user.key().as_ref()],
        bump = user_profile.bump
    )]
    pub user_profile: Account<'info, UserProfile>,

    pub user: Signer<'info>,
}

#[derive(Accounts)]
pub struct LinkCNftToPost<'info> {
    #[account(mut)]
    pub post: Account<'info, Post>,
    
    #[account(mut)]
    pub author: Signer<'info>,
}

// Custom Errors
#[error_code]
pub enum SocialError {
    #[msg("Content cannot be longer than 280 characters")]
    ContentTooLong,
    #[msg("Content cannot be empty")]
    ContentEmpty,
    #[msg("Username cannot be longer than 50 characters")]
    UsernameTooLong,
    #[msg("Bio cannot be longer than 160 characters")]
    BioTooLong,
    #[msg("Avatar URL cannot be longer than 200 characters")]
    AvatarUrlTooLong,
    #[msg("Display Name cannot be longer than 50 characters")]
    DisplayNameTooLong,
    #[msg("Location cannot be longer than 100 characters")]
    LocationTooLong,
    #[msg("Website URL cannot be longer than 200 characters")]
    WebsiteUrlTooLong,
    #[msg("Cover Image URL cannot be longer than 200 characters")]
    CoverImageUrlTooLong,
    #[msg("Image arrays must have the same length")]
    ImageArraysMismatch,
    #[msg("Too many images")]
    TooManyImages,
    #[msg("Chunk size cannot exceed 9KB")]
    ChunkTooLarge,
    #[msg("Not an image post")]
    NotImagePost,
}
